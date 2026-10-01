import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import type { NotificationDelivery } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAIL_TRANSPORT, type MailTransport } from './mail/mail-transport';
import { PUSH_TRANSPORT, type PushTransport } from './push/push-transport';
import { templates, type RenderedNotification } from './templates';
import { signUnsubscribeToken } from './unsubscribe-token';

/**
 * First non-empty line of a plaintext body — the push fallback when a template
 * offers no push copy of its own. Email bodies open with the sentence that
 * matters, so this reads correctly rather than truncating mid-greeting.
 */
function firstLine(text: string): string {
  return text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
}

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
    @Inject(PUSH_TRANSPORT) private readonly push: PushTransport,
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
    const due = await this.prisma.notificationDelivery.findMany({
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
  private async claim(id: string): Promise<NotificationDelivery | null> {
    const { count } = await this.prisma.notificationDelivery.updateMany({
      where: { id, status: 'QUEUED' },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    });
    if (count === 0) return null;
    return this.prisma.notificationDelivery.findUnique({ where: { id } });
  }

  private async deliver(row: NotificationDelivery): Promise<boolean> {
    try {
      const reason = await this.suppressionReason(row);
      if (reason) {
        await this.prisma.notificationDelivery.update({
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

      const token = this.unsubscribeToken(row);
      const unsubscribeUrl = `${this.webUrl()}/unsubscribe?token=${token}`;
      const rendered = render(row.payload as Record<string, unknown>, {
        boardName: board.name,
        webUrl: this.webUrl(),
        unsubscribeUrl,
        timezone: board.timezone,
      });

      // One rendered notification, two ways out. The template is rendered once
      // either way so email and push can never describe the event differently.
      if (row.channel === 'PUSH') {
        await this.deliverPush(row, rendered);
      } else {
        await this.transport.send({
          to: user.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          idempotencyKey: row.dedupeKey,
          unsubscribeUrl,
          unsubscribePostUrl: `${this.apiUrl()}/unsubscribe?token=${token}`,
        });
      }

      await this.prisma.notificationDelivery.update({
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
   * Sends to every device the recipient has registered, then deletes any token
   * Expo reports as gone. A dead token is permanent — retrying it would burn
   * the row's attempts and eventually fail a delivery that actually succeeded
   * on the person's other devices.
   */
  private async deliverPush(
    row: NotificationDelivery,
    rendered: RenderedNotification,
  ): Promise<void> {
    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: row.userId },
      select: { token: true },
    });
    // suppressionReason() already rejected the no-device case, so an empty list
    // here means the last device was unregistered between that check and this
    // read. Thrown rather than returned: returning would let deliver() stamp
    // the row SENT and record a delivery that never happened.
    if (devices.length === 0) {
      throw new Error('recipient has no registered device');
    }

    const { invalidTokens } = await this.push.send({
      tokens: devices.map((d) => d.token),
      title: rendered.push?.title ?? rendered.subject,
      body: rendered.push?.body ?? firstLine(rendered.text),
      data: { boardId: row.boardId, template: row.template },
      idempotencyKey: row.dedupeKey,
    });

    if (invalidTokens.length > 0) {
      await this.prisma.deviceToken.deleteMany({
        where: { token: { in: invalidTokens } },
      });
      this.logger.log(`Pruned ${invalidTokens.length} dead device token(s)`);
    }
  }

  /**
   * Re-checked at send time, not at queue time: someone can leave the board or
   * mute a category in the seconds between.
   */
  private async suppressionReason(row: NotificationDelivery): Promise<string | null> {
    const [user, membership, preferences] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: row.userId },
        select: { email: true },
      }),
      this.prisma.membership.findUnique({
        where: { boardId_userId: { boardId: row.boardId, userId: row.userId } },
        select: { id: true },
      }),
      // Both channels for this category, so a push row can honour an email
      // mute. Nothing writes PUSH preference rows yet — the settings card and
      // the unsubscribe link are email-scoped — so reading only `row.channel`
      // would mean a muted category still buzzed the phone, and no API existed
      // to stop it. Someone who mutes "mentions" means it; the explicit PUSH
      // row wins once a screen exists to write one.
      this.prisma.notificationPreference.findMany({
        where: {
          boardId: row.boardId,
          userId: row.userId,
          category: row.category,
        },
        select: { channel: true, enabled: true },
      }),
    ]);

    const forChannel = preferences.find((p) => p.channel === row.channel);
    const forEmail = preferences.find((p) => p.channel === 'EMAIL');
    const preference = forChannel ?? forEmail;

    if (!user) return 'recipient no longer exists';
    if (!membership) return 'recipient is no longer a board member';
    // A missing preference row means enabled — nothing to backfill.
    if (preference && !preference.enabled) return 'category muted';

    // Undeliverability means different things per channel. An email bounces;
    // a push has nowhere to go. Everything above this line is shared.
    if (row.channel === 'PUSH') {
      const devices = await this.prisma.deviceToken.count({
        where: { userId: row.userId },
      });
      return devices === 0 ? 'recipient has no registered device' : null;
    }

    const suppressed = await this.prisma.emailSuppression.findUnique({
      where: { email: user.email },
      select: { reason: true },
    });
    return suppressed ? `address suppressed (${suppressed.reason})` : null;
  }

  private async recordFailure(
    row: NotificationDelivery,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const backoff = BACKOFF_MS[row.attempts - 1];

    if (backoff === undefined) {
      this.logger.error(`Giving up on ${row.dedupeKey}: ${message}`);
      await this.prisma.notificationDelivery.update({
        where: { id: row.id },
        data: { status: 'FAILED', lastError: message },
      });
      return;
    }

    this.logger.warn(`Retrying ${row.dedupeKey} in ${backoff}ms: ${message}`);
    await this.prisma.notificationDelivery.update({
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

  /** Where the one-click header points. The web app is a static client bundle
   * and cannot answer a POST; this endpoint can. */
  private apiUrl(): string {
    return this.config.get<string>('API_URL') ?? 'http://localhost:3001';
  }

  private unsubscribeToken(row: NotificationDelivery): string {
    return signUnsubscribeToken(
      { userId: row.userId, boardId: row.boardId, category: row.category },
      this.config.getOrThrow<string>('UNSUBSCRIBE_SECRET'),
    );
  }
}
