import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The two Resend events that mean "stop sending here". Everything else Resend
 * emits — delivered, opened, clicked — is telemetry we don't keep.
 */
export type ResendEvent = {
  type: string;
  data?: {
    to?: unknown;
    bounce?: { type?: string; subType?: string; message?: string };
  };
};

/**
 * Writes the table the dispatcher has been reading since phase 1. Until now
 * `EmailSuppression` had a reader and no writer: a dead address burned all
 * four retry attempts on every message and failed with an opaque SMTP error.
 */
@Injectable()
export class SuppressionsService {
  private readonly logger = new Logger(SuppressionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the addresses it suppressed, which is what the tests assert on. */
  async handle(event: ResendEvent): Promise<string[]> {
    const reason = this.reasonFor(event);
    if (!reason) return [];

    // `to` is an array of impacted recipients — usually one, but a single
    // message can be addressed to several.
    const recipients = (Array.isArray(event.data?.to) ? event.data.to : [])
      .filter((value): value is string => typeof value === 'string')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    for (const email of recipients) {
      await this.prisma.emailSuppression.upsert({
        where: { email },
        // An address that complains after bouncing keeps its first reason —
        // whichever came first is the one that explains the silence.
        create: { email, reason },
        update: {},
      });
      this.logger.warn(`Suppressing ${email}: ${reason}`);
    }
    return recipients;
  }

  private reasonFor(event: ResendEvent): string | null {
    if (event.type === 'email.complained') return 'complaint';
    if (event.type !== 'email.bounced') return null;

    // Resend only raises email.bounced for permanent rejections, but the
    // payload still carries the type — and suppressing an address over a full
    // mailbox or a temporary outage would lose real mail.
    const type = event.data?.bounce?.type;
    if (type && type !== 'Permanent') return null;
    return 'bounce';
  }
}
