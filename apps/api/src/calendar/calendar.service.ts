import { Injectable } from '@nestjs/common';
import type { CalendarQueryDto, EventType } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface CalendarItemDto {
  /** What kind of record this is — drives icon/color and click-through target. */
  kind: 'EVENT' | 'TASK' | 'GOAL' | 'REMINDER';
  id: string;
  title: string;
  /** The instant the item appears at on the calendar. */
  date: Date;
  event?: { type: EventType; endsAt: Date | null; location: string | null };
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
 * Aggregates everything datable on a board into one range query for the
 * month grid: events (startsAt), tasks (dueDate), goals (dueDate) and
 * open reminders (remindAt). Range is [from, to). Archived items are
 * excluded everywhere — the calendar is part of the dashboard they left.
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async range(
    boardId: string,
    userId: string,
    query: CalendarQueryDto,
  ): Promise<CalendarItemDto[]> {
    const window = { gte: query.from, lt: query.to };

    const [events, tasks, goals, reminders] = await Promise.all([
      this.prisma.event.findMany({
        where: { boardId, startsAt: window, archivedAt: null },
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: { boardId, dueDate: window, archivedAt: null },
        // Pull only the requesting user's assignee row, if any, so we can flag
        // "assigned to me" without loading every assignee.
        include: {
          status: true,
          assignees: { where: { userId }, select: { userId: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.goal.findMany({
        where: { boardId, dueDate: window, archivedAt: null },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.reminder.findMany({
        // Once a reminder is done it has nothing left to say about the day.
        where: { boardId, remindAt: window, done: false, archivedAt: null },
        orderBy: { remindAt: 'asc' },
      }),
    ]);

    const items: CalendarItemDto[] = [
      ...events.map((e): CalendarItemDto => ({
        kind: 'EVENT',
        id: e.id,
        title: e.title,
        date: e.startsAt,
        event: { type: e.type, endsAt: e.endsAt, location: e.location },
      })),
      ...tasks.map((t): CalendarItemDto => ({
        kind: 'TASK',
        id: t.id,
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
        title: g.title,
        date: g.dueDate as Date,
        goal: { period: g.period, completed: g.completedAt !== null },
      })),
      ...reminders.map((r): CalendarItemDto => ({
        kind: 'REMINDER',
        id: r.id,
        title: r.title,
        // The range filter above already drops the undated ones.
        date: r.remindAt as Date,
      })),
    ];

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}
