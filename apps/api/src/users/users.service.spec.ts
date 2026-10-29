import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

describe('UsersService.bootstrap', () => {
  const tx = {
    user: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    authUser: { findUnique: jest.fn() },
    invite: { findMany: jest.fn(), update: jest.fn() },
    membership: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    board: { create: jest.fn() },
    activity: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<void>) => fn(tx)),
    user: { findUnique: jest.fn() },
  };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
  );
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

  it('creates no band for a new user with no invite', async () => {
    tx.invite.findMany.mockResolvedValue([]);
    tx.membership.findFirst.mockResolvedValue(null);

    await service.bootstrap(auth);

    expect(tx.user.upsert).toHaveBeenCalled();
    expect(tx.board.create).not.toHaveBeenCalled();
    expect(tx.membership.upsert).not.toHaveBeenCalled();
  });

  it('activates pending invites', async () => {
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

  describe('adopting a User row left from Supabase Auth', () => {
    beforeEach(() => tx.invite.findMany.mockResolvedValue([]));

    it('moves an orphaned row with the same email onto the new account', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 'old' });
      tx.authUser.findUnique.mockResolvedValue(null);

      await service.bootstrap(auth);

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'old' },
        data: { id: 'u1' },
      });
    });

    it('never takes over a row that belongs to a live account', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 'other' });
      tx.authUser.findUnique.mockResolvedValue({ id: 'other' });

      await service.bootstrap(auth);

      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('does nothing when the row is already this account', async () => {
      tx.user.findUnique.mockResolvedValue({ id: 'u1' });

      await service.bootstrap(auth);

      expect(tx.authUser.findUnique).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });
  });
});

describe('UsersService.me — multi-board', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
  );

  const auth = { userId: 'u1', email: 'drums@band.test' };

  const board = (id: string, name: string) => ({
    id,
    name,
    defaultLayout: [],
    theme: null,
  });

  beforeEach(() => jest.clearAllMocks());

  it('lists every board the caller belongs to, with the role on each', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: auth.email,
      displayName: 'Ringo',
      avatarUrl: null,
      memberships: [
        { id: 'm1', role: 'ADMIN', board: board('b1', 'Neon Harbor') },
        { id: 'm2', role: 'USER', board: board('b2', 'Weekend Duo') },
      ],
    });

    const me = await service.me(auth);

    expect(me.boards).toEqual([
      {
        id: 'b1',
        name: 'Neon Harbor',
        membershipId: 'm1',
        role: 'ADMIN',
        palette: 'playful',
      },
      {
        id: 'b2',
        name: 'Weekend Duo',
        membershipId: 'm2',
        role: 'USER',
        palette: 'playful',
      },
    ]);
  });

  /**
   * `GET /boards` and this list are built by the same mapper precisely so they
   * cannot disagree. This is the assertion that would fail if someone inlined
   * one of them again.
   */
  it('colours each board with its own palette, like GET /boards does', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: auth.email,
      displayName: 'Ringo',
      avatarUrl: null,
      memberships: [
        {
          id: 'm1',
          role: 'ADMIN',
          board: {
            ...board('b1', 'Neon Harbor'),
            theme: { palette: 'forest' },
          },
        },
        { id: 'm2', role: 'USER', board: board('b2', 'Weekend Duo') },
      ],
    });

    const me = await service.me(auth);

    expect(me.boards.map((b) => b.palette)).toEqual(['forest', 'playful']);
  });

  /**
   * The additive contract this whole phase rests on: fifteen files in apps/web
   * read `membership`/`board`, and app-shell.tsx gates the entire authenticated
   * app on `board` being non-null. If these stop agreeing with boards[0], web
   * breaks without a single web file having changed.
   */
  it('keeps the legacy single board pointing at boards[0]', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: auth.email,
      displayName: 'Ringo',
      avatarUrl: null,
      memberships: [
        { id: 'm1', role: 'ADMIN', board: board('b1', 'Neon Harbor') },
        { id: 'm2', role: 'USER', board: board('b2', 'Weekend Duo') },
      ],
    });

    const me = await service.me(auth);

    expect(me.board?.id).toBe(me.boards[0].id);
    expect(me.membership).toEqual({ id: 'm1', role: 'ADMIN' });
    // Specifically NOT the second board, however many there are.
    expect(me.board?.name).toBe('Neon Harbor');
  });

  // Someone mid-invite has a User row and no membership. app-shell.tsx renders
  // an error state for this rather than crashing, so the shape has to hold.
  it('returns an empty list and null legacy fields with no memberships', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: auth.email,
      displayName: 'Ringo',
      avatarUrl: null,
      memberships: [],
    });

    const me = await service.me(auth);

    expect(me.boards).toEqual([]);
    expect(me.board).toBeNull();
    expect(me.membership).toBeNull();
  });
});
