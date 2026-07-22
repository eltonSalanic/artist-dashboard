import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ActivityService', () => {
  const prisma = {
    activity: { create: jest.fn(), findMany: jest.fn() },
  };
  const service = new ActivityService(prisma as unknown as PrismaService);

  const row = (id: string) => ({
    id,
    type: 'TASK_CREATED',
    actor: { id: 'u1', displayName: 'sam', avatarUrl: null },
    meta: {},
    createdAt: new Date(),
  });

  beforeEach(() => jest.clearAllMocks());

  it('writes through whichever client it is handed', async () => {
    const tx = { activity: { create: jest.fn() } };
    await service.log(tx as never, {
      boardId: 'b1',
      type: 'COMMENT_ADDED',
      actorId: 'u1',
      meta: { taskId: 't1' },
    });

    expect(tx.activity.create).toHaveBeenCalledWith({
      data: {
        boardId: 'b1',
        type: 'COMMENT_ADDED',
        actorId: 'u1',
        meta: { taskId: 't1' },
      },
    });
    expect(prisma.activity.create).not.toHaveBeenCalled();
  });

  it('defaults a missing actor and meta rather than writing undefined', async () => {
    await service.log(prisma as unknown as PrismaService, {
      boardId: 'b1',
      type: 'TASK_CREATED',
    });

    expect(prisma.activity.create).toHaveBeenCalledWith({
      data: { boardId: 'b1', type: 'TASK_CREATED', actorId: null, meta: {} },
    });
  });

  it('returns a nextCursor and trims the lookahead row when more pages exist', async () => {
    prisma.activity.findMany.mockResolvedValue([
      row('a1'),
      row('a2'),
      row('a3'),
    ]);

    const page = await service.feed('b1', { limit: 2 });

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
    expect(page.items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(page.nextCursor).toBe('a2');
  });

  it('reports no next page when the lookahead row is absent', async () => {
    prisma.activity.findMany.mockResolvedValue([row('a1')]);

    const page = await service.feed('b1', { limit: 2 });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('skips the cursor row so pages never overlap', async () => {
    prisma.activity.findMany.mockResolvedValue([]);

    await service.feed('b1', { limit: 20, cursor: 'a9' });

    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'a9' }, skip: 1 }),
    );
  });
});
