import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DEFAULT_BOARD_THEME, type BoardThemeDto } from '@artist/shared';
import { BoardsService } from './boards.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import type { BillingService } from '../billing/billing.service';

/** Billing not enforced, as in dev: every board summary reads as open. */
const billingOff = { enforced: false } as unknown as BillingService;

describe('BoardsService.removeMember', () => {
  const prisma = {
    membership: { findFirst: jest.fn(), delete: jest.fn() },
    userLayout: { deleteMany: jest.fn() },
    taskAssignee: { deleteMany: jest.fn() },
    mentionNotification: { deleteMany: jest.fn() },
    notificationPreference: { deleteMany: jest.fn() },
    activity: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const service = new BoardsService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
    billingOff,
  );

  beforeEach(() => jest.clearAllMocks());

  it('refuses to remove yourself', async () => {
    await expect(service.removeMember('b1', 'u1', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
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
    /**
     * Mention rows carry a snapshotted task title and comment excerpt — this
     * board's own text. Leaving them meant an ex-member's inbox still held it,
     * which BoardRolesGuard only happened to hide by 404-ing before the
     * mentions service ran. The cross-board route has no such 404.
     */
    expect(prisma.mentionNotification.deleteMany).toHaveBeenCalledWith({
      where: { boardId: 'b1', userId: 'u2' },
    });
    // Their preferences about mail they can no longer receive, which would
    // otherwise silently resurrect on a re-invite.
    expect(prisma.notificationPreference.deleteMany).toHaveBeenCalledWith({
      where: { boardId: 'b1', userId: 'u2' },
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

describe('BoardsService board theme', () => {
  const prisma = {
    board: { findUnique: jest.fn(), update: jest.fn() },
  };
  const service = new BoardsService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
    billingOff,
  );

  beforeEach(() => jest.clearAllMocks());

  const board = (theme: unknown) => ({
    id: 'b1',
    name: 'Neon Harbor',
    defaultLayout: [],
    theme,
    statuses: [],
    showStatuses: [],
    memberships: [],
  });

  it('normalizes an untouched theme column to the default theme', async () => {
    prisma.board.findUnique.mockResolvedValue(board({}));

    const result = await service.findOne('b1');

    expect(result.theme).toEqual(DEFAULT_BOARD_THEME);
  });

  it('returns the stored palette and widget colors', async () => {
    prisma.board.findUnique.mockResolvedValue(
      board({ palette: 'ocean', widgets: { FOCUS: 'c2' } }),
    );

    const result = await service.findOne('b1');

    expect(result.theme).toEqual({
      palette: 'ocean',
      widgets: { FOCUS: 'c2' },
    });
  });

  it('drops values it does not recognize instead of failing the board', async () => {
    prisma.board.findUnique.mockResolvedValue(
      board({ palette: 'neon', widgets: { GOALS: 'c1', BOGUS: 'c3' } }),
    );

    const result = await service.findOne('b1');

    expect(result.theme).toEqual({
      palette: 'playful',
      widgets: { GOALS: 'c1' },
    });
  });

  it('writes the whole theme through on save', async () => {
    const dto: BoardThemeDto = {
      palette: 'forest',
      widgets: { SHOWS: 'c4', REMINDERS: 'base' },
    };
    prisma.board.update.mockResolvedValue({ id: 'b1', theme: dto });

    const result = await service.saveTheme('b1', dto);

    expect(prisma.board.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { theme: dto },
      select: { id: true, theme: true },
    });
    expect(result).toEqual({ id: 'b1', theme: dto });
  });
});

describe('BoardsService.findAllForUser', () => {
  const membership = { findMany: jest.fn() };
  const prisma = { membership };
  const service = new BoardsService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
    billingOff,
  );

  beforeEach(() => jest.clearAllMocks());

  /**
   * This route has no `:boardId`, so BoardRolesGuard cannot run on it. The
   * `where` clause is the entire authorisation — hence a test on the query
   * itself, not only on the mapped output.
   */
  it('scopes the query to the caller, which is the only thing keeping other bands out', async () => {
    membership.findMany.mockResolvedValue([]);

    await service.findAllForUser('u1');

    const [args] = membership.findMany.mock.calls[0] as [
      { where: unknown; orderBy: unknown },
    ];
    expect(args.where).toEqual({ userId: 'u1' });
  });

  // A person can be admin of their own project and an ordinary member of
  // someone else's, so there is no single "user role" to cache anywhere.
  it('reports the role per board, not per user', async () => {
    membership.findMany.mockResolvedValue([
      {
        id: 'm1',
        role: 'ADMIN',
        board: { id: 'b1', name: 'Neon Harbor', theme: { palette: 'ocean' } },
      },
      {
        id: 'm2',
        role: 'USER',
        board: { id: 'b2', name: 'Weekend Duo', theme: {} },
      },
    ]);

    await expect(service.findAllForUser('u1')).resolves.toEqual([
      {
        id: 'b1',
        name: 'Neon Harbor',
        membershipId: 'm1',
        role: 'ADMIN',
        palette: 'ocean',
        isPro: false,
        subscriptionRequired: false,
      },
      {
        id: 'b2',
        name: 'Weekend Duo',
        membershipId: 'm2',
        role: 'USER',
        palette: 'playful',
        isPro: false,
        subscriptionRequired: false,
      },
    ]);
  });

  // Oldest-first, so the list is stable between calls and boards[0] is the
  // same board /me still reports in its legacy single `board` field.
  it('orders oldest first so the list is stable', async () => {
    membership.findMany.mockResolvedValue([]);

    await service.findAllForUser('u1');

    const [args] = membership.findMany.mock.calls[0] as [
      { orderBy: { createdAt: string } },
    ];
    expect(args.orderBy).toEqual({ createdAt: 'asc' });
  });

  // Someone mid-invite, or whose last board was deleted, has no boards. That
  // is a legitimate state, not an error.
  it('returns an empty list rather than throwing when there are no boards', async () => {
    membership.findMany.mockResolvedValue([]);
    await expect(service.findAllForUser('u1')).resolves.toEqual([]);
  });

  /**
   * Listing twenty bands must not mean fetching twenty layouts. `theme` is on
   * the row either way, so the palette is free; `defaultLayout` is the field
   * that would make this expensive, and it stays out. The subscription is one
   * row per board, read for the Band Pro badge.
   */
  it('selects only what a switcher needs', async () => {
    membership.findMany.mockResolvedValue([]);

    await service.findAllForUser('u1');

    const [args] = membership.findMany.mock.calls[0] as [
      { select: { board: { select: Record<string, unknown> } } },
    ];
    expect(args.select.board.select).toEqual({
      id: true,
      name: true,
      theme: true,
      subscription: { select: { status: true, currentPeriodEnd: true } },
    });
  });

  // An unreadable theme must not cost the whole list: a board with no palette
  // set still has to appear, coloured like the default.
  it('falls back to the default palette rather than dropping the board', async () => {
    membership.findMany.mockResolvedValue([
      {
        id: 'm1',
        role: 'ADMIN',
        board: { id: 'b1', name: 'Neon Harbor', theme: 'not-an-object' },
      },
    ]);

    const [board] = await service.findAllForUser('u1');
    expect(board.palette).toBe('playful');
  });
});

describe('BoardsService.create', () => {
  const prisma = { board: { create: jest.fn() } };
  const service = new BoardsService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
    billingOff,
  );

  it('makes the caller the only admin, with default statuses and layout', async () => {
    prisma.board.create.mockResolvedValue({
      id: 'b9',
      name: 'Side Project',
      theme: {},
      memberships: [{ id: 'm9', role: 'ADMIN' }],
    });

    const summary = await service.create('u1', { name: 'Side Project' });

    const [args] = prisma.board.create.mock.calls[0] as [
      {
        data: {
          name: string;
          defaultLayout: unknown[];
          memberships: { create: unknown };
          statuses: { create: unknown[] };
          showStatuses: { create: { name: string }[] };
        };
      },
    ];
    expect(args.data.name).toBe('Side Project');
    expect(args.data.memberships.create).toEqual({
      userId: 'u1',
      role: 'ADMIN',
    });
    expect(args.data.statuses.create.length).toBeGreaterThan(0);
    expect(args.data.showStatuses.create.map((s) => s.name)).toEqual([
      'Hold',
      'Details pending',
      'Confirmed',
      'Cancelled',
    ]);
    expect(args.data.defaultLayout.length).toBeGreaterThan(0);
    expect(summary).toEqual(
      expect.objectContaining({
        id: 'b9',
        name: 'Side Project',
        membershipId: 'm9',
        role: 'ADMIN',
      }),
    );
  });
});
