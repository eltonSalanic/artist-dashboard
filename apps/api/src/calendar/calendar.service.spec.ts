import { CalendarService } from './calendar.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CalendarService', () => {
  const prisma = {
    event: { findMany: jest.fn() },
    task: { findMany: jest.fn() },
    goal: { findMany: jest.fn() },
    reminder: { findMany: jest.fn() },
  };
  const service = new CalendarService(prisma as unknown as PrismaService);

  const query = {
    from: '2026-03-01T00:00:00.000Z',
    to: '2026-04-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.event.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.goal.findMany.mockResolvedValue([]);
    prisma.reminder.findMany.mockResolvedValue([]);
  });

  it('scopes every source query to the board and the half-open range', async () => {
    await service.range('b1', 'u1', query);

    const window = { gte: query.from, lt: query.to };
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { boardId: 'b1', startsAt: window, archivedAt: null },
      }),
    );
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { boardId: 'b1', dueDate: window, archivedAt: null },
      }),
    );
    expect(prisma.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { boardId: 'b1', dueDate: window, archivedAt: null },
      }),
    );
    // Done reminders are filtered out here — a finished note tells you
    // nothing about the day it was pinned to.
    expect(prisma.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          boardId: 'b1',
          remindAt: window,
          done: false,
          archivedAt: null,
        },
      }),
    );
  });

  it('keeps archived items off the calendar entirely', async () => {
    await service.range('b1', 'u1', query);

    for (const source of [
      prisma.event.findMany,
      prisma.task.findMany,
      prisma.goal.findMany,
      prisma.reminder.findMany,
    ]) {
      expect(source).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ archivedAt: null }),
        }),
      );
    }
  });

  it('merges all four sources into one chronological list', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'Gig',
        type: 'SHOW',
        startsAt: new Date('2026-03-10T20:00:00Z'),
        endsAt: null,
        location: 'The Venue',
      },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Print posters',
        dueDate: new Date('2026-03-05T12:00:00Z'),
        status: { color: '#abc', name: 'Doing', isDone: false },
        assignees: [],
      },
    ]);
    prisma.goal.findMany.mockResolvedValue([
      {
        id: 'g1',
        title: 'Finish the EP',
        dueDate: new Date('2026-03-31T00:00:00Z'),
        period: 'MONTHLY',
        completedAt: null,
      },
    ]);
    prisma.reminder.findMany.mockResolvedValue([
      {
        id: 'r1',
        title: 'Pay the rehearsal room',
        remindAt: new Date('2026-03-01T09:00:00Z'),
        done: false,
      },
    ]);

    const items = await service.range('b1', 'u1', query);

    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ['REMINDER', 'r1'],
      ['TASK', 't1'],
      ['EVENT', 'e1'],
      ['GOAL', 'g1'],
    ]);
  });

  it('carries the per-kind detail each chip needs to render', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'Gig',
        type: 'SHOW',
        startsAt: new Date('2026-03-10T20:00:00Z'),
        endsAt: new Date('2026-03-10T23:00:00Z'),
        location: 'The Venue',
      },
    ]);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Print posters',
        dueDate: new Date('2026-03-05T12:00:00Z'),
        status: { color: '#abc', name: 'Done', isDone: true },
        // The service pre-filters assignees to the requesting user, so a
        // non-empty array here means "assigned to me".
        assignees: [{ userId: 'u1' }],
      },
    ]);
    prisma.goal.findMany.mockResolvedValue([
      {
        id: 'g1',
        title: 'Finish the EP',
        dueDate: new Date('2026-03-31T00:00:00Z'),
        period: 'MONTHLY',
        completedAt: new Date('2026-03-20T00:00:00Z'),
      },
    ]);

    const items = await service.range('b1', 'u1', query);
    const byKind = Object.fromEntries(items.map((i) => [i.kind, i]));

    expect(byKind.EVENT.event).toEqual({
      type: 'SHOW',
      endsAt: new Date('2026-03-10T23:00:00Z'),
      location: 'The Venue',
    });
    expect(byKind.TASK.task).toEqual({
      statusColor: '#abc',
      statusName: 'Done',
      isDone: true,
      assignedToMe: true,
    });
    expect(byKind.GOAL.goal).toEqual({ period: 'MONTHLY', completed: true });
  });
});
