import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { OutgoingPush, PushResult, PushTransport } from './push-transport';
import { maskToken } from '../../common/redact';

/**
 * Expo's push endpoint, spoken to directly over fetch.
 *
 * `expo-server-sdk` is the official client and would normally be the answer,
 * but it is ESM-only (`"type": "module"`), which is the same wall this codebase
 * already hit with svix — ts-jest cannot require it. The request and response
 * shapes, the endpoint, the 100-recipient chunk limit and the
 * DeviceNotRegistered sentinel below were all read off the type definitions in
 * expo-server-sdk@7.2.0 rather than recalled.
 *
 * Note what the message format does *not* have: any idempotency key. Email gets
 * one via Resend; push does not, so a crash between a successful send and the
 * SENT write means a duplicate buzz.
 *
 * Reference: https://docs.expo.dev/push-notifications/sending-notifications/
 */
const SEND_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo's documented ceiling on recipients per request. */
const CHUNK = 100;

/**
 * APNs' `apns-collapse-id`, which Expo's `collapseId` becomes, may be at most
 * 64 bytes, and Apple rejects the whole notification otherwise
 * (InvalidCollapseId). Dedupe keys run longer — a reminder's is 96 characters
 * — and that rejection is invisible here: Expo's ticket still says "ok", the
 * error only appears in the receipt fetched later. So the key is hashed: a
 * fixed 43 characters, and the same key always yields the same id, which is
 * all collapsing needs.
 */
export function collapseIdFor(dedupeKey: string): string {
  return createHash('sha256').update(dedupeKey).digest('base64url');
}

/** The one ticket error that means "delete this token", not "retry later". */
const DEVICE_GONE = 'DeviceNotRegistered';

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string; expoPushToken?: string };
}

export class ExpoPushTransport implements PushTransport {
  private readonly logger = new Logger(ExpoPushTransport.name);

  /** Optional: only required once a project turns on push security. */
  constructor(private readonly accessToken?: string) {}

  async send(push: OutgoingPush): Promise<PushResult> {
    const invalidTokens: string[] = [];

    for (let i = 0; i < push.tokens.length; i += CHUNK) {
      const tokens = push.tokens.slice(i, i + CHUNK);
      const response = await fetch(SEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.accessToken
            ? { Authorization: `Bearer ${this.accessToken}` }
            : {}),
        },
        body: JSON.stringify({
          to: tokens,
          title: push.title,
          body: push.body,
          data: push.data,
          // `collapseId`, not an idempotency key — Expo's message format has no
          // such field (`id` appears only on the ticket it returns). So unlike
          // email, push has NO provider-side guard for the window between a
          // successful send and recording it: if that write fails, the delivery
          // re-queues and the phone is notified again. What this does buy is
          // that the repeat *replaces* the earlier notification on the device
          // rather than stacking beside it.
          collapseId: collapseIdFor(push.idempotencyKey),
          sound: 'default',
          priority: 'high',
        }),
      });

      if (!response.ok) {
        // Thrown, so the dispatcher's backoff handles it as a transient
        // failure. A 4xx from a bad payload will exhaust retries and land in
        // FAILED, which is where it belongs.
        throw new Error(
          `Expo push responded ${response.status} ${response.statusText}`,
        );
      }

      const body = (await response.json()) as {
        data?: ExpoTicket[];
        errors?: { message?: string; code?: string }[];
      };

      // A 200 can still carry a top-level `errors` array, or no `data` at all.
      // Treating either as a clean send would stamp the row SENT and lose the
      // notification silently — no retry, no log. The official SDK throws here
      // too, so throwing keeps the dispatcher's backoff in charge.
      if (body.errors?.length) {
        throw new Error(
          `Expo push rejected the request: ${body.errors
            .map((e) => e.code ?? e.message ?? 'unknown')
            .join(', ')}`,
        );
      }
      if (!Array.isArray(body.data)) {
        throw new Error('Expo push returned no ticket array');
      }

      const tickets = body.data;

      // Tickets come back positionally — the nth ticket is for the nth token —
      // but only trust that when the counts actually line up. A short or offset
      // array would otherwise attribute a DeviceNotRegistered to the wrong
      // token and delete a live device while keeping the dead one.
      const positional = tickets.length === tokens.length;
      if (!positional) {
        this.logger.warn(
          `Expo returned ${tickets.length} ticket(s) for ${tokens.length} token(s); ` +
            'falling back to echoed tokens only',
        );
      }

      tickets.forEach((ticket, index) => {
        if (ticket.status !== 'error') return;
        const token =
          ticket.details?.expoPushToken ??
          (positional ? tokens[index] : undefined);
        if (ticket.details?.error === DEVICE_GONE) {
          // Without a token we cannot say *which* device died, and guessing
          // would delete a working one. Logged and left for the next send,
          // which will report it again.
          if (token) invalidTokens.push(token);
          else this.logger.warn('DeviceNotRegistered with no token to match');
          return;
        }
        this.logger.warn(
          `Expo push ticket error for ${token ? maskToken(token) : 'unknown token'}: ${
            ticket.details?.error ?? ticket.message
          }`,
        );
      });
    }

    return { invalidTokens };
  }
}
