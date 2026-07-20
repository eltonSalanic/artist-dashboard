import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService.bootstrap', () => {
  const tx = {
    user: { upsert: jest.fn() },
    invite: { findMany: jest.fn(), update: jest.fn() },
    membership: { upsert: jest.fn(), findFirst: jest.fn() },
    board: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    user: { findUnique: jest.fn() },
  };
  const service = new UsersService(prisma as unknown as PrismaService);
  const auth = { userId: 'u1', email: 'sam@band.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: auth.email,
      displayName: 'sam',
      avatarUrl: null,
      memberships: [{ id: 'm1', role: 'ADMIN', board: { id: 'b1' } }],
    });
  });

  it('creates a board with admin membership when the user has none', async () => {
    tx.invite.findMany.mockResolvedValue([]);
    tx.membership.findFirst.mockResolvedValue(null);

    await service.bootstrap(auth);

    expect(tx.board.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberships: { create: { userId: 'u1', role: 'ADMIN' } },
        }),
      }),
    );
  });

  it('activates pending invites instead of creating a new board', async () => {
    tx.invite.findMany.mockResolvedValue([
      { id: 'i1', boardId: 'b9', role: 'USER' },
    ]);
    tx.membership.findFirst.mockResolvedValue({ id: 'm1' });

    await service.bootstrap(auth);

    expect(tx.membership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { boardId: 'b9', userId: 'u1', role: 'USER' },
      }),
    );
    expect(tx.invite.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { status: 'ACCEPTED' },
    });
    expect(tx.board.create).not.toHaveBeenCalled();
  });
});
