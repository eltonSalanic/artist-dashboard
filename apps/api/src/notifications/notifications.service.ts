import { Injectable } from '@nestjs/common';
import {
  NotificationCategories,
  type NotificationCategory,
  type NotificationPreferencesDto,
} from '@artist/shared';
import { Prisma, type EmailCategory } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Either the root client or a `$transaction` client — the same writer union
 * ActivityService uses, so `queue()` drops in beside `log()` at every call site.
 */
export type NotificationWriter = PrismaService | Prisma.TransactionClient;

export interface QueueEmailInput {
  boardId: string;
  /** Recipient. Their address is resolved at send time, not now. */
  userId: string;
  category: EmailCategory;
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
    inputs: QueueEmailInput | QueueEmailInput[],
  ): Promise<void> {
    const rows = Array.isArray(inputs) ? inputs : [inputs];
    if (rows.length === 0) return;

    await client.emailDelivery.createMany({
      data: rows.map((row) => ({
        boardId: row.boardId,
        userId: row.userId,
        category: row.category,
        template: row.template,
        dedupeKey: row.dedupeKey,
        payload: (row.payload ?? {}) as Prisma.InputJsonValue,
      })),
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
    const rows = await this.prisma.notificationPreference.findMany({
      where: { boardId, userId },
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
      where: { boardId_userId_category: { boardId, userId, category } },
      create: { boardId, userId, category, enabled },
      update: { enabled },
    });
    return this.preferences(boardId, userId);
  }
}
