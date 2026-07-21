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
    await service.range('b1', query);

    const window = { gte: query.from, lt: query.to };
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: 'b1', startsAt: window } }),
    );
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: 'b1', dueDate: window } }),
    );
    expect(prisma.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: 'b1', dueDate: window } }),
    );
    expect(prisma.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: 'b1', remindAt: window } }),
    );
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

    const items = await service.range('b1', query);

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

    const items = await service.range('b1', query);
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
    });
    expect(byKind.GOAL.goal).toEqual({ period: 'MONTHLY', completed: true });
  });
});
