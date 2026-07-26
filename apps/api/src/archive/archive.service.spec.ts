import { NotFoundException } from '@nestjs/common';
import { ArchiveService } from './archive.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

describe('ArchiveService', () => {
  const prisma = {
    task: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    goal: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    event: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    reminder: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  // Transactions run against the same mock, so assertions on `prisma.task`
  // still see writes made inside one.
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );

  const tasks = { collectTaskTree: jest.fn() };
  const storage = { remove: jest.fn() };
  const service = new ArchiveService(
    prisma as unknown as PrismaService,
    tasks as unknown as TasksService,
  );

  const noCascade = { cascadeTasks: false };
  const cascade = { cascadeTasks: true };

  /** The `data` Prisma was asked to write on the nth task update. */
  const taskUpdate = (n: number): Record<string, unknown> => {
    const calls = prisma.task.updateMany.mock.calls as [
      { where: unknown; data: Record<string, unknown> },
    ][];
    return calls[n][0].data;
  };
  const taskUpdateWhere = (n: number): Record<string, unknown> => {
    const calls = prisma.task.updateMany.mock.calls as [
      { where: Record<string, unknown>; data: unknown },
    ][];
    return calls[n][0].where;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.task.findFirst.mockResolvedValue({ id: 't1' });
    prisma.goal.findFirst.mockResolvedValue({ id: 'g1' });
    prisma.event.findFirst.mockResolvedValue({ id: 'e1' });
    prisma.reminder.findFirst.mockResolvedValue({ id: 'r1' });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.goal.findMany.mockResolvedValue([]);
    prisma.event.findMany.mockResolvedValue([]);
    prisma.reminder.findMany.mockResolvedValue([]);
    tasks.collectTaskTree.mockResolvedValue(['t1']);
  });

  describe('archive', () => {
    it('stamps archivedAt and never touches storage', async () => {
      await service.archive('b1', 'REMINDER', 'r1', noCascade);

      const calls = prisma.reminder.updateMany.mock.calls as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ][];
      const call = calls[0][0];
      expect(call.where).toEqual({
        id: 'r1',
        boardId: 'b1',
        archivedAt: null,
      });
      expect(call.data.archivedAt).toBeInstanceOf(Date);
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('archives a task on its own with no provenance', async () => {
      await service.archive('b1', 'TASK', 't1', noCascade);

      expect(taskUpdate(0).archivedAt).toBeInstanceOf(Date);
      expect(taskUpdate(0).archivedWithId).toBeNull();
    });

    it('sweeps subtasks in with their parent, stamped with its id', async () => {
      tasks.collectTaskTree.mockResolvedValue(['t1', 't2', 't3']);

      await service.archive('b1', 'TASK', 't1', noCascade);

      expect(taskUpdateWhere(1)).toEqual({
        id: { in: ['t2', 't3'] },
        boardId: 'b1',
        archivedAt: null,
      });
      expect(taskUpdate(1).archivedAt).toBeInstanceOf(Date);
      expect(taskUpdate(1).archivedWithId).toBe('t1');
    });

    it('leaves an event’s tasks alone without cascadeTasks', async () => {
      await service.archive('b1', 'EVENT', 'e1', noCascade);

      expect(prisma.event.updateMany).toHaveBeenCalled();
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('stamps every cascaded task with the parent id, whatever its depth', async () => {
      prisma.task.findMany.mockResolvedValue([{ id: 't1' }, { id: 't9' }]);
      tasks.collectTaskTree.mockImplementation((id: string) =>
        Promise.resolve(id === 't1' ? ['t1', 't2'] : ['t9']),
      );

      await service.archive('b1', 'EVENT', 'e1', cascade);

      expect(taskUpdateWhere(0)).toEqual({
        id: { in: ['t1', 't2', 't9'] },
        boardId: 'b1',
        archivedAt: null,
      });
      expect(taskUpdate(0).archivedAt).toBeInstanceOf(Date);
      expect(taskUpdate(0).archivedWithId).toBe('e1');
    });

    it('only archives rows that are still live, so timestamps survive', async () => {
      await service.archive('b1', 'GOAL', 'g1', noCascade);

      expect(prisma.goal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'g1', boardId: 'b1', archivedAt: null },
        }),
      );
    });

    it('refuses an item on another board', async () => {
      prisma.goal.findFirst.mockResolvedValue(null);

      await expect(
        service.archive('b1', 'GOAL', 'g1', noCascade),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('restore', () => {
    it('clears archivedAt and provenance together', async () => {
      await service.restore('b1', 'TASK', 't1', noCascade);

      expect(taskUpdate(0)).toEqual({ archivedAt: null, archivedWithId: null });
    });

    it('brings a task’s subtasks back with it, unprompted', async () => {
      await service.restore('b1', 'TASK', 't1', noCascade);

      expect(taskUpdateWhere(1)).toEqual({
        boardId: 'b1',
        archivedWithId: 't1',
      });
    });

    it('restores an event alone unless cascade is asked for', async () => {
      await service.restore('b1', 'EVENT', 'e1', noCascade);

      expect(prisma.event.updateMany).toHaveBeenCalledWith({
        where: { id: 'e1', boardId: 'b1' },
        data: { archivedAt: null },
      });
      expect(prisma.task.updateMany).not.toHaveBeenCalled();
    });

    it('restores exactly the tasks that went down with the event', async () => {
      await service.restore('b1', 'EVENT', 'e1', cascade);

      expect(taskUpdateWhere(0)).toEqual({
        boardId: 'b1',
        archivedWithId: 'e1',
      });
      expect(taskUpdate(0)).toEqual({ archivedAt: null, archivedWithId: null });
    });
  });

  describe('list', () => {
    it('asks every source for archived rows only', async () => {
      await service.list('b1', { limit: 500 });

      for (const source of [
        prisma.task.findMany,
        prisma.goal.findMany,
        prisma.event.findMany,
        prisma.reminder.findMany,
      ]) {
        expect(source).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { boardId: 'b1', archivedAt: { not: null } },
          }),
        );
      }
    });

    it('merges the four sources newest-archived first', async () => {
      prisma.task.findMany.mockResolvedValue([
        {
          id: 't1',
          title: 'Load in',
          archivedAt: new Date('2026-03-02T00:00:00Z'),
          dueDate: null,
          status: { name: 'Done', color: '#0f0', isDone: true },
        },
      ]);
      prisma.event.findMany.mockResolvedValue([
        {
          id: 'e1',
          title: 'Bowery show',
          archivedAt: new Date('2026-03-05T00:00:00Z'),
          startsAt: new Date('2026-02-01T00:00:00Z'),
          type: 'SHOW',
          location: 'NYC',
        },
      ]);
      prisma.reminder.findMany.mockResolvedValue([
        {
          id: 'r1',
          title: 'Pay the sound guy',
          archivedAt: new Date('2026-03-01T00:00:00Z'),
          remindAt: null,
        },
      ]);

      const items = await service.list('b1', { limit: 500 });

      expect(items.map((i) => i.id)).toEqual(['e1', 't1', 'r1']);
      expect(items[0]).toMatchObject({
        kind: 'EVENT',
        event: { type: 'SHOW', location: 'NYC' },
      });
    });

    it('caps the merged list, not just each source', async () => {
      const at = (d: string) => new Date(d);
      prisma.task.findMany.mockResolvedValue([
        {
          id: 't1',
          title: 'a',
          archivedAt: at('2026-03-01T00:00:00Z'),
          dueDate: null,
          status: { name: 'Done', color: '#0f0', isDone: true },
        },
      ]);
      prisma.reminder.findMany.mockResolvedValue([
        {
          id: 'r1',
          title: 'b',
          archivedAt: at('2026-03-02T00:00:00Z'),
          remindAt: null,
        },
      ]);

      const items = await service.list('b1', { limit: 1 });

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('r1');
    });
  });
});
