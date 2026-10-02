import { MentionsService } from './mentions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MentionsService', () => {
  const mentionNotification = { findMany: jest.fn(), deleteMany: jest.fn() };
  const prisma = { mentionNotification };
  const service = new MentionsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    mentionNotification.findMany.mockResolvedValue([]);
    mentionNotification.deleteMany.mockResolvedValue({ count: 0 });
  });

  const whereOf = (mock: jest.Mock): Record<string, unknown> => {
    const [args] = mock.mock.calls[0] as [{ where: Record<string, unknown> }];
    return args.where;
  };

  describe('list', () => {
    it('filters on the recipient and the board set together', async () => {
      await service.list(['b1', 'b2'], 'u1');

      expect(whereOf(mentionNotification.findMany)).toEqual({
        userId: 'u1',
        boardId: { in: ['b1', 'b2'] },
      });
    });

    /**
     * The finding this whole phase turned on.
     *
     * These rows carry a snapshotted task title and comment excerpt — the
     * board's own text. `removeMember` did not delete them, and
     * `BoardRolesGuard` was hiding that by 404-ing on the missing membership
     * before the service ran. On a route with no `:boardId` there is no such
     * 404, so scoping by recipient alone would hand an ex-member another band's
     * content indefinitely, re-fetched every thirty seconds by the client.
     *
     * The board term is what re-derives access from live membership on every
     * request, instead of trusting a cleanup to have happened.
     */
    it('never filters by recipient alone', async () => {
      await service.list(['b1'], 'u1');

      const where = whereOf(mentionNotification.findMany);
      expect(where).toHaveProperty('boardId');
      expect(where.boardId).not.toBeUndefined();
    });

    it('returns nothing, and queries nothing, for an empty board set', async () => {
      await expect(service.list([], 'u1')).resolves.toEqual([]);
      expect(mentionNotification.findMany).not.toHaveBeenCalled();
    });

    it('labels each row with the board it came from', async () => {
      mentionNotification.findMany.mockResolvedValue([
        {
          id: 'm1',
          taskId: 't1',
          boardId: 'b2',
          actorName: 'Dana',
          taskTitle: 'Mix notes',
          excerpt: 'can you check the mix?',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          board: { name: 'Weekend Duo' },
        },
      ]);

      const [row] = await service.list(['b1', 'b2'], 'u1');

      expect(row.boardId).toBe('b2');
      expect(row.boardName).toBe('Weekend Duo');
    });

    it('asks for newest first', async () => {
      await service.list(['b1'], 'u1');
      const [args] = mentionNotification.findMany.mock.calls[0] as [
        { orderBy: unknown },
      ];
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('clear', () => {
    it('deletes only within the recipients own board set', async () => {
      await service.clear(['b1', 'b2'], 'u1');

      expect(whereOf(mentionNotification.deleteMany)).toEqual({
        userId: 'u1',
        boardId: { in: ['b1', 'b2'] },
      });
    });

    // A narrowed clear is how the mobile inbox's "Clear all" stays one band's
    // worth when the inbox is filtered.
    it('honours a single-board set', async () => {
      await service.clear(['b2'], 'u1');

      expect(whereOf(mentionNotification.deleteMany)).toEqual({
        userId: 'u1',
        boardId: { in: ['b2'] },
      });
    });

    // Must not fall through to an unscoped deleteMany.
    it('deletes nothing for an empty board set', async () => {
      await expect(service.clear([], 'u1')).resolves.toEqual({
        deleted: true,
      });
      expect(mentionNotification.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('scopes the delete by id, recipient and board set', async () => {
      await service.remove(['b1'], 'u1', 'm9');

      expect(whereOf(mentionNotification.deleteMany)).toEqual({
        id: 'm9',
        userId: 'u1',
        boardId: { in: ['b1'] },
      });
    });

    // deleteMany rather than delete, so an id outside scope is a silent no-op
    // instead of a 404 that would confirm the row exists.
    it('reports success for an out-of-scope id without revealing it', async () => {
      mentionNotification.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.remove(['b1'], 'u1', 'other-board-row'),
      ).resolves.toEqual({ deleted: true });
    });

    it('deletes nothing for an empty board set', async () => {
      await expect(service.remove([], 'u1', 'm9')).resolves.toEqual({
        deleted: true,
      });
      expect(mentionNotification.deleteMany).not.toHaveBeenCalled();
    });
  });
});
