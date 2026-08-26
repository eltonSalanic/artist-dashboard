import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import type { EmailDelivery } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_TRANSPORT, type MailTransport } from './mail/mail-transport';
import { templates } from './templates';
import { signUnsubscribeToken } from './unsubscribe-token';

/** Waits between retries. Index by attempts-so-far; past the end, give up. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const BATCH = 20;

/**
 * Drains the outbox. Runs on every API instance, which is the point: claiming
 * is a conditional update, so two instances waking together can't both send the
 * same row.
 */
@Injectable()
export class DispatcherService {
  private readonly logger = new Logger(DispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {}

  @Interval(10_000)
  async tick(): Promise<void> {
    try {
      await this.drain();
    } catch (error) {
      // A tick must never throw — the next one has to keep trying.
      this.logger.error('Dispatcher tick failed', error as Error);
    }
  }

  async drain(limit = BATCH): Promise<number> {
    const due = await this.prisma.emailDelivery.findMany({
      where: { status: 'QUEUED', sendAfter: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });

    let sent = 0;
    for (const { id } of due) {
      const row = await this.claim(id);
      // Claimed by another instance between the read and the update.
      if (!row) continue;
      if (await this.deliver(row)) sent += 1;
    }
    return sent;
  }

  /**
   * `updateMany` filtered on the status we expect, so the write itself is the
   * lock: exactly one caller sees count === 1.
   */
  private async claim(id: string): Promise<EmailDelivery | null> {
    const { count } = await this.prisma.emailDelivery.updateMany({
      where: { id, status: 'QUEUED' },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    });
    if (count === 0) return null;
    return this.prisma.emailDelivery.findUnique({ where: { id } });
  }

  private async deliver(row: EmailDelivery): Promise<boolean> {
    try {
      const reason = await this.suppressionReason(row);
      if (reason) {
        await this.prisma.emailDelivery.update({
          where: { id: row.id },
          data: { status: 'SUPPRESSED', lastError: reason },
        });
        return false;
      }

      const render = templates[row.template];
      if (!render) throw new Error(`Unknown template "${row.template}"`);

      const [user, board] = await Promise.all([
        this.prisma.user.findUniqueOrThrow({ where: { id: row.userId } }),
        this.prisma.board.findUniqueOrThrow({ where: { id: row.boardId } }),
      ]);

      const unsubscribeUrl = this.unsubscribeUrl(row);
      const mail = render(row.payload as Record<string, unknown>, {
        boardName: board.name,
        webUrl: this.webUrl(),
        unsubscribeUrl,
      });

      await this.transport.send({
        to: user.email,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        idempotencyKey: row.dedupeKey,
        unsubscribeUrl,
      });

      await this.prisma.emailDelivery.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });
      return true;
    } catch (error) {
      await this.recordFailure(row, error);
      return false;
    }
  }

  /**
   * Re-checked at send time, not at queue time: someone can leave the board or
   * mute a category in the seconds between.
   */
  private async suppressionReason(row: EmailDelivery): Promise<string | null> {
    const [user, membership, preference] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: row.userId },
        select: { email: true },
      }),
      this.prisma.membership.findUnique({
        where: { boardId_userId: { boardId: row.boardId, userId: row.userId } },
        select: { id: true },
      }),
      this.prisma.notificationPreference.findUnique({
        where: {
          boardId_userId_category: {
            boardId: row.boardId,
            userId: row.userId,
            category: row.category,
          },
        },
        select: { enabled: true },
      }),
    ]);

    if (!user) return 'recipient no longer exists';
    if (!membership) return 'recipient is no longer a board member';
    // A missing preference row means enabled — nothing to backfill.
    if (preference && !preference.enabled) return 'category muted';

    const suppressed = await this.prisma.emailSuppression.findUnique({
      where: { email: user.email },
      select: { reason: true },
    });
    return suppressed ? `address suppressed (${suppressed.reason})` : null;
  }

  private async recordFailure(
    row: EmailDelivery,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const backoff = BACKOFF_MS[row.attempts - 1];

    if (backoff === undefined) {
      this.logger.error(`Giving up on ${row.dedupeKey}: ${message}`);
      await this.prisma.emailDelivery.update({
        where: { id: row.id },
        data: { status: 'FAILED', lastError: message },
      });
      return;
    }

    this.logger.warn(`Retrying ${row.dedupeKey} in ${backoff}ms: ${message}`);
    await this.prisma.emailDelivery.update({
      where: { id: row.id },
      data: {
        status: 'QUEUED',
        lastError: message,
        sendAfter: new Date(Date.now() + backoff),
      },
    });
  }

  private webUrl(): string {
    return this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';
  }

  private unsubscribeUrl(row: EmailDelivery): string {
    const token = signUnsubscribeToken(
      { userId: row.userId, boardId: row.boardId, category: row.category },
      this.config.getOrThrow<string>('UNSUBSCRIBE_SECRET'),
    );
    return `${this.webUrl()}/unsubscribe?token=${token}`;
  }
}
