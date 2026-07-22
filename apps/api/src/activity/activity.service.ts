import { Injectable } from '@nestjs/common';
import type { ActivityQueryDto, ActivityType } from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Either the root client or a `$transaction` client, so `log()` can be called
 * inside the same transaction as the mutation it describes.
 */
export type ActivityWriter = PrismaService | Prisma.TransactionClient;

export interface LogActivityInput {
  boardId: string;
  type: ActivityType;
  /** Null for system-driven entries with no human behind them. */
  actorId?: string | null;
  /**
   * Denormalized snapshot rendered by the feed — titles and names are copied
   * in at write time so an entry still reads correctly after the subject is
   * renamed or deleted.
   */
  meta?: Record<string, unknown>;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  log(client: ActivityWriter, input: LogActivityInput) {
    return client.activity.create({
      data: {
        boardId: input.boardId,
        type: input.type,
        actorId: input.actorId ?? null,
        meta: (input.meta ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Newest-first page. `cursor` is the id of the last item already shown;
   * the row it points at is skipped, so pages never overlap.
   */
  async feed(boardId: string, query: ActivityQueryDto) {
    const rows = await this.prisma.activity.findMany({
      where: { boardId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        actor: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // The extra row only tells us whether another page exists.
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: items.map((row) => ({
        id: row.id,
        type: row.type,
        actor: row.actor,
        meta: row.meta as Record<string, unknown>,
        createdAt: row.createdAt,
      })),
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }
}
