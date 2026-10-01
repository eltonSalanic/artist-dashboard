import { Logger } from '@nestjs/common';
import type {
  OutgoingPush,
  PushResult,
  PushTransport,
} from './push-transport';

/**
 * Expo's push endpoint, spoken to directly over fetch.
 *
 * `expo-server-sdk` is the official client and would normally be the answer,
 * but it is ESM-only (`"type": "module"`), which is the same wall this codebase
 * already hit with svix — ts-jest cannot require it. The request and response
 * shapes, the endpoint, the 100-message chunk limit and the DeviceNotRegistered
 * sentinel below were all read off expo-server-sdk@7.2.0 rather than recalled.
 *
 * Reference: https://docs.expo.dev/push-notifications/sending-notifications/
 */
const SEND_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo's documented ceiling on recipients per request. */
const CHUNK = 100;

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
          // Expo collapses repeats of the same id, which covers the window
          // between a successful send and recording it that the outbox cannot.
          id: push.idempotencyKey,
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

      const body = (await response.json()) as { data?: ExpoTicket[] };
      const tickets = body.data ?? [];

      // Tickets come back positionally — the nth ticket is for the nth token.
      tickets.forEach((ticket, index) => {
        if (ticket.status !== 'error') return;
        const token = ticket.details?.expoPushToken ?? tokens[index];
        if (ticket.details?.error === DEVICE_GONE) {
          if (token) invalidTokens.push(token);
          return;
        }
        this.logger.warn(
          `Expo push ticket error for ${token}: ${ticket.details?.error ?? ticket.message}`,
        );
      });
    }

    return { invalidTokens };
  }
}
