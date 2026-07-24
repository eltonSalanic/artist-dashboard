import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

describe('BoardsService.removeMember', () => {
  const prisma = {
    membership: { findFirst: jest.fn(), delete: jest.fn() },
    userLayout: { deleteMany: jest.fn() },
    taskAssignee: { deleteMany: jest.fn() },
    activity: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const service = new BoardsService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
  );

  beforeEach(() => jest.clearAllMocks());

  it('refuses to remove yourself', async () => {
    await expect(
      service.removeMember('b1', 'u1', 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.membership.delete).not.toHaveBeenCalled();
  });

  it('404s when the target is not a member', async () => {
    prisma.membership.findFirst.mockResolvedValue(null);
    await expect(
      service.removeMember('b1', 'admin', 'ghost'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the membership, cleans up board data and logs it', async () => {
    prisma.membership.findFirst.mockResolvedValue({
      id: 'm2',
      user: { displayName: 'sam' },
    });

    const result = await service.removeMember('b1', 'admin', 'u2');

    expect(prisma.membership.delete).toHaveBeenCalledWith({
      where: { id: 'm2' },
    });
    expect(prisma.userLayout.deleteMany).toHaveBeenCalledWith({
      where: { boardId: 'b1', userId: 'u2' },
    });
    expect(prisma.taskAssignee.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u2', task: { boardId: 'b1' } },
    });
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'MEMBER_REMOVED',
          meta: expect.objectContaining({ removedFromBoard: true }),
        }),
      }),
    );
    expect(result).toEqual({ removed: true });
  });
});
