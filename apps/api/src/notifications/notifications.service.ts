import { Injectable } from '@nestjs/common';
import {
  NotificationCategories,
  type NotificationCategory,
  type NotificationPreferencesDto,
} from '@artist/shared';
import {
  Prisma,
  type NotificationCategory as DbNotificationCategory,
  type NotificationChannel,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Either the root client or a `$transaction` client — the same writer union
 * ActivityService uses, so `queue()` drops in beside `log()` at every call site.
 */
export type NotificationWriter = PrismaService | Prisma.TransactionClient;

/**
 * Every notification is queued on every channel, and the dispatcher decides at
 * send time whether each one can actually go out — a push row for someone with
 * no registered device is SUPPRESSED exactly as an email row for a bounced
 * address is. That follows the pipeline's existing rule that recipients are
 * resolved at send time, not at queue time, and keeps `queue()` a single cheap
 * write inside the caller's transaction instead of a per-recipient lookup.
 */
const FAN_OUT: NotificationChannel[] = ['EMAIL', 'PUSH'];

export interface QueueNotificationInput {
  boardId: string;
  /** Recipient. Their address is resolved at send time, not now. */
  userId: string;
  category: DbNotificationCategory;
  /** Key into the template registry. */
  template: string;
  /**
   * Deterministic per (trigger, subject row, recipient). Two processes racing
   * on the same real-world event must compute the same string — that is what
   * makes the unique index do its job.
   */
  dedupeKey: string;
  /** Snapshot the template renders from. */
  payload?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everyone on the board except the person who caused the thing — the
   * recipient list for every board-wide trigger. Design rule 2: never email
   * the actor for their own action.
   */
  async boardRecipients(
    client: NotificationWriter,
    boardId: string,
    exceptUserId?: string,
  ): Promise<string[]> {
    const memberships = await client.membership.findMany({
      where: { boardId },
      select: { userId: true },
    });
    return memberships
      .map((m) => m.userId)
      .filter((userId) => userId !== exceptUserId);
  }

  /**
   * Writes outbox rows. Call it inside the mutation's own transaction: if the
   * mutation rolls back, the notification goes with it, and nothing is sent
   * until the transaction commits.
   *
   * Uses `skipDuplicates` rather than catching a unique violation, because a
   * constraint error inside a Postgres transaction poisons the whole
   * transaction — catching it would still lose the mutation.
   */
  async queue(
    client: NotificationWriter,
    inputs: QueueNotificationInput | QueueNotificationInput[],
  ): Promise<void> {
    const rows = Array.isArray(inputs) ? inputs : [inputs];
    if (rows.length === 0) return;

    await client.notificationDelivery.createMany({
      data: rows.flatMap((row) =>
        FAN_OUT.map((channel) => ({
          boardId: row.boardId,
          userId: row.userId,
          category: row.category,
          channel,
          template: row.template,
          dedupeKey: row.dedupeKey,
          payload: (row.payload ?? {}) as Prisma.InputJsonValue,
        })),
      ),
      skipDuplicates: true,
    });
  }

  /**
   * Every category with its current state. Absent rows mean on — someone who
   * has never opened their settings has no rows at all, and backfilling them
   * would only be writing the default down.
   */
  async preferences(
    boardId: string,
    userId: string,
  ): Promise<NotificationPreferencesDto> {
    // Scoped to email on purpose. The table now carries a channel, but the
    // only UI that exists is the email settings card, and widening this DTO
    // would change apps/web for no user-visible gain. Push preferences get
    // surfaced when the mobile app has a screen for them.
    const rows = await this.prisma.notificationPreference.findMany({
      where: { boardId, userId, channel: 'EMAIL' },
      select: { category: true, enabled: true },
    });
    const byCategory = new Map(rows.map((row) => [row.category, row.enabled]));

    return Object.fromEntries(
      NotificationCategories.map((category) => [
        category,
        byCategory.get(category) ?? true,
      ]),
    ) as NotificationPreferencesDto;
  }

  /** Upsert: the first toggle writes the row, later ones flip it. */
  async setPreference(
    boardId: string,
    userId: string,
    category: NotificationCategory,
    enabled: boolean,
  ): Promise<NotificationPreferencesDto> {
    await this.prisma.notificationPreference.upsert({
      where: {
        boardId_userId_category_channel: {
          boardId,
          userId,
          category,
          channel: 'EMAIL',
        },
      },
      create: { boardId, userId, category, channel: 'EMAIL', enabled },
      update: { enabled },
    });
    return this.preferences(boardId, userId);
  }
}
