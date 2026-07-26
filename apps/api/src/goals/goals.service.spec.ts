import { NotFoundException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { TasksService } from '../tasks/tasks.service';

describe('GoalsService', () => {
  const prisma = {
    goal: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: { findMany: jest.fn(), count: jest.fn() },
    activity: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  // Transactions run against the same mock, so assertions on `prisma.goal`
  // still see writes made inside one.
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const tasks = { removeMany: jest.fn() };
  const service = new GoalsService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
    tasks as unknown as TasksService,
  );

  /** The `data` Prisma was asked to write on the most recent update. */
  const lastUpdateData = (): {
    completedAt?: Date | null;
    completed?: boolean;
  } => {
    const calls = prisma.goal.update.mock.calls as [
      { data: { completedAt?: Date | null; completed?: boolean } },
    ][];
    return calls[calls.length - 1][0].data;
  };

  beforeEach(() => jest.clearAllMocks());

  it('hides completed goals when includeCompleted is false', async () => {
    prisma.goal.findMany.mockResolvedValue([]);
    await service.list('b1', { includeCompleted: false });

    expect(prisma.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { boardId: 'b1', archivedAt: null, completedAt: null },
      }),
    );
  });

  it('always hides archived goals from the list', async () => {
    prisma.goal.findMany.mockResolvedValue([]);
    await service.list('b1', { includeCompleted: true });

    expect(prisma.goal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null }),
      }),
    );
  });

  it('leaves linked tasks alone when deleting a goal without cascade', async () => {
    prisma.goal.findFirst.mockResolvedValue({ id: 'g1' });
    await service.remove('b1', 'g1');

    expect(tasks.removeMany).not.toHaveBeenCalled();
    expect(prisma.goal.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });

  it('deletes linked tasks at any depth when cascade is asked for', async () => {
    prisma.goal.findFirst.mockResolvedValue({ id: 'g1' });
    prisma.task.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);

    await service.remove('b1', 'g1', true);

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: 'b1', goalId: 'g1' } }),
    );
    expect(tasks.removeMany).toHaveBeenCalledWith('b1', ['t1', 't2']);
  });

  it('stamps completedAt when a goal is marked complete', async () => {
    prisma.goal.findFirst.mockResolvedValue({ id: 'g1', completedAt: null });
    prisma.goal.update.mockResolvedValue({ _count: { tasks: 0 } });

    await service.update('b1', 'g1', 'u1', { completed: true });

    expect(lastUpdateData().completedAt).toBeInstanceOf(Date);
    expect(lastUpdateData()).not.toHaveProperty('completed');
  });

  it('keeps the original completedAt when re-completing an already-done goal', async () => {
    const completedAt = new Date('2026-03-01T00:00:00Z');
    prisma.goal.findFirst.mockResolvedValue({ id: 'g1', completedAt });
    prisma.goal.update.mockResolvedValue({ _count: { tasks: 0 } });

    await service.update('b1', 'g1', 'u1', { completed: true });

    expect(lastUpdateData().completedAt).toBe(completedAt);
  });

  it('clears completedAt when a goal is reopened', async () => {
    prisma.goal.findFirst.mockResolvedValue({
      id: 'g1',
      completedAt: new Date(),
    });
    prisma.goal.update.mockResolvedValue({ _count: { tasks: 0 } });

    await service.update('b1', 'g1', 'u1', { completed: false });

    expect(lastUpdateData().completedAt).toBeNull();
  });

  it('leaves completedAt untouched when the update omits `completed`', async () => {
    prisma.goal.findFirst.mockResolvedValue({ id: 'g1', completedAt: null });
    prisma.goal.update.mockResolvedValue({ _count: { tasks: 0 } });

    await service.update('b1', 'g1', 'u1', { title: 'New title' });

    expect(lastUpdateData()).not.toHaveProperty('completedAt');
  });

  it('refuses to touch a goal on another board', async () => {
    prisma.goal.findFirst.mockResolvedValue(null);
    await expect(service.update('b1', 'g1', 'u1', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
