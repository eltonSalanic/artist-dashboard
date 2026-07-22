import { NotFoundException } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

describe('GoalsService', () => {
  const prisma = {
    goal: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    activity: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  // Transactions run against the same mock, so assertions on `prisma.goal`
  // still see writes made inside one.
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const service = new GoalsService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
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
      expect.objectContaining({ where: { boardId: 'b1', completedAt: null } }),
    );
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
