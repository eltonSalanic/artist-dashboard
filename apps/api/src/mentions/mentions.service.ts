import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MentionNotificationDto {
  id: string;
  taskId: string;
  /**
   * Which board the mention happened on. Needed to open the task — every
   * click-through is board-scoped — and to label the row when the inbox is
   * merged across bands.
   */
  boardId: string;
  boardName: string;
  actorName: string;
  taskTitle: string;
  excerpt: string;
  createdAt: Date;
}

/**
 * A member's own "you were mentioned" notifications.
 *
 * **Every query filters on `userId` AND the board set, never on `userId`
 * alone**, even though `userId` looks sufficient — these rows are addressed to
 * a person, so scoping by recipient reads as complete. It is not.
 *
 * `MentionNotification` carries a snapshotted `taskTitle` and comment
 * `excerpt`: this board's text, stored so the row survives the comment being
 * edited or deleted. Those rows were not cleaned up when a member was removed,
 * and `BoardRolesGuard` was hiding that — it 404s on the missing membership
 * before this service ever runs. On a route with no `:boardId` there is no such
 * 404, so a `{ userId }` filter would have handed an ex-member another band's
 * content indefinitely, re-fetched every thirty seconds by the existing client.
 *
 * `removeMember` now deletes those rows, but the board filter is the
 * load-bearing fix: it re-derives access from live membership on every single
 * request, rather than trusting a cleanup to have happened.
 *
 * Same reasoning as the dispatcher's send-time membership re-check — access is
 * checked when the data is used, not when it was written.
 */
@Injectable()
export class MentionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The recipient's mention notifications across the given boards, newest first. */
  async list(
    boardIds: string[],
    userId: string,
  ): Promise<MentionNotificationDto[]> {
    if (boardIds.length === 0) return [];

    const rows = await this.prisma.mentionNotification.findMany({
      where: { userId, boardId: { in: boardIds } },
      orderBy: { createdAt: 'desc' },
      include: { board: { select: { name: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      boardId: row.boardId,
      boardName: row.board.name,
      actorName: row.actorName,
      taskTitle: row.taskTitle,
      excerpt: row.excerpt,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Dismiss a single notification. Scoped to the recipient *and* their boards,
   * so an unknown or out-of-scope id is a silent no-op rather than a 404 that
   * would confirm the row exists.
   */
  async remove(boardIds: string[], userId: string, id: string) {
    if (boardIds.length === 0) return { deleted: true };

    await this.prisma.mentionNotification.deleteMany({
      where: { id, userId, boardId: { in: boardIds } },
    });
    return { deleted: true };
  }

  /**
   * Dismiss the recipient's notifications across the given boards.
   *
   * The caller decides the breadth by what it passes: the board-scoped route
   * hands over one id, the cross-board one hands over all of them. That is a
   * real difference in blast radius, so it is the controller's decision to make
   * explicitly rather than something this method assumes.
   */
  async clear(boardIds: string[], userId: string) {
    if (boardIds.length === 0) return { deleted: true };

    await this.prisma.mentionNotification.deleteMany({
      where: { userId, boardId: { in: boardIds } },
    });
    return { deleted: true };
  }
}
