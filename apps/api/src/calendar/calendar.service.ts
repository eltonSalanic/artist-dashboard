import { Injectable } from '@nestjs/common';
import type {
  CalendarQueryDto,
  EventType,
  ShowStatusCategory,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface CalendarItemDto {
  /** What kind of record this is — drives icon/color and click-through target. */
  kind: 'EVENT' | 'TASK' | 'GOAL' | 'REMINDER';
  id: string;
  /**
   * Which board this came from. Not optional, and not only for colour-coding:
   * merged across bands, two items called "Load in" are otherwise
   * indistinguishable and neither can be linked to, since every click-through
   * URL is board-scoped.
   */
  boardId: string;
  /** Shown as the subtitle on a merged list, so colour is never the only cue. */
  boardName: string;
  title: string;
  /** The instant the item appears at on the calendar. */
  date: Date;
  event?: {
    type: EventType;
    endsAt: Date | null;
    location: string | null;
    /**
     * Shows only. Cancelled shows are still sent: the calendar strikes them
     * through and hides them behind a filter rather than losing them.
     */
    showStatus: {
      name: string;
      color: string;
      category: ShowStatusCategory;
    } | null;
  };
  task?: {
    statusColor: string;
    statusName: string;
    isDone: boolean;
    /** True when the requesting user is one of the task's assignees. */
    assignedToMe: boolean;
  };
  goal?: { period: string; completed: boolean };
}

/**
 * Aggregates everything datable across one or more boards into a single range
 * query for the month grid: events (startsAt), tasks (dueDate), goals (dueDate)
 * and open reminders (remindAt). Range is [from, to). Archived items are
 * excluded everywhere — the calendar is part of the dashboard they left.
 *
 * Takes a **list** of board ids, never a single one, and never an optional one.
 * On the cross-board route there is no `:boardId` for BoardRolesGuard to check,
 * so `{ in: boardIds }` is the entire tenancy boundary; a `string | undefined`
 * signature would let a caller drop it, and Prisma treats a missing `in` as no
 * filter rather than an empty one — which returns every board in the database.
 * The array type is what makes that unexpressible.
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async range(
    boardIds: string[],
    userId: string,
    query: CalendarQueryDto,
  ): Promise<CalendarItemDto[]> {
    // `{ in: [] }` matches nothing, which is the right answer for someone who
    // belongs to no board. Returning early just saves five pointless queries.
    if (boardIds.length === 0) return [];

    const window = { gte: query.from, lt: query.to };
    const board = { in: boardIds };

    const [boards, events, tasks, goals, reminders] = await Promise.all([
      // Names once, rather than joining Board onto every row of four queries.
      this.prisma.board.findMany({
        where: { id: board },
        select: { id: true, name: true },
      }),
      this.prisma.event.findMany({
        where: { boardId: board, startsAt: window, archivedAt: null },
        include: {
          showStatus: { select: { name: true, color: true, category: true } },
        },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { boardId: board, dueDate: window, archivedAt: null },
        // Pull only the requesting user's assignee row, if any, so we can flag
        // "assigned to me" without loading every assignee.
        include: {
          status: true,
          assignees: { where: { userId }, select: { userId: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.goal.findMany({
        where: { boardId: board, dueDate: window, archivedAt: null },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.reminder.findMany({
        // Once a reminder is done it has nothing left to say about the day.
        where: {
          boardId: board,
          remindAt: window,
          done: false,
          archivedAt: null,
        },
        orderBy: { remindAt: 'asc' },
      }),
    ]);

    const nameOf = new Map(boards.map((b) => [b.id, b.name]));
    const named = (boardId: string) => ({
      boardId,
      boardName: nameOf.get(boardId) ?? '',
    });

    const items: CalendarItemDto[] = [
      ...events.map((e): CalendarItemDto => ({
        kind: 'EVENT',
        id: e.id,
        ...named(e.boardId),
        title: e.title,
        date: e.startsAt,
        event: {
          type: e.type,
          endsAt: e.endsAt,
          location: e.location,
          showStatus: e.showStatus,
        },
      })),
      ...tasks.map((t): CalendarItemDto => ({
        kind: 'TASK',
        id: t.id,
        ...named(t.boardId),
        title: t.title,
        date: t.dueDate as Date,
        task: {
          statusColor: t.status.color,
          statusName: t.status.name,
          isDone: t.status.isDone,
          assignedToMe: t.assignees.length > 0,
        },
      })),
      ...goals.map((g): CalendarItemDto => ({
        kind: 'GOAL',
        id: g.id,
        ...named(g.boardId),
        title: g.title,
        date: g.dueDate as Date,
        goal: { period: g.period, completed: g.completedAt !== null },
      })),
      ...reminders.map((r): CalendarItemDto => ({
        kind: 'REMINDER',
        id: r.id,
        ...named(r.boardId),
        title: r.title,
        // The range filter above already drops the undated ones.
        date: r.remindAt as Date,
      })),
    ];

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}
