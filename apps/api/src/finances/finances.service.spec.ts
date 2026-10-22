import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FinancesService, type FinanceActor } from './finances.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

describe('FinancesService', () => {
  const admin: FinanceActor = { userId: 'u1', role: 'ADMIN' };
  const member: FinanceActor = { userId: 'u2', role: 'USER' };

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'f1',
    boardId: 'b1',
    kind: 'INCOME',
    state: 'SETTLED',
    category: 'SHOW_FEE',
    amountCents: 40_000,
    occurredOn: new Date('2026-10-01T00:00:00Z'),
    counterparty: null,
    description: '',
    eventId: null,
    handledById: null,
    createdById: 'u1',
    createdAt: new Date('2026-10-01T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z'),
    splits: [
      { userId: 'u1', shareBps: 5000 },
      { userId: 'u2', shareBps: 5000 },
    ],
    event: null,
    _count: { receipts: 0 },
    ...over,
  });

  const prisma = {
    financeEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    financeSplit: { deleteMany: jest.fn() },
    splitShare: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    payout: { findMany: jest.fn(), create: jest.fn() },
    membership: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    event: { findFirst: jest.fn(), findMany: jest.fn() },
    board: { findUnique: jest.fn(), update: jest.fn() },
    activity: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );
  /** Arguments of the nth `financeEntry.create` call. */
  const createCall = (n: number): unknown =>
    (prisma.financeEntry.create.mock.calls as unknown[][])[n][0];

  const service = new FinancesService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.board.findUnique.mockResolvedValue({ currency: 'USD' });
    prisma.splitShare.findMany.mockResolvedValue([]);
    prisma.membership.findMany.mockImplementation(
      (args: { where: { userId?: { in: string[] } } }) =>
        Promise.resolve(
          (args.where.userId?.in ?? ['u1', 'u2']).map((userId) => ({
            userId,
            user: { id: userId, displayName: userId === 'u1' ? 'Ana' : 'Ben' },
          })),
        ),
    );
    prisma.user.findMany.mockResolvedValue([
      { id: 'u1', displayName: 'Ana' },
      { id: 'u2', displayName: 'Ben' },
    ]);
    prisma.financeEntry.create.mockResolvedValue(row());
  });

  describe('create', () => {
    const dto = {
      kind: 'EXPENSE' as const,
      category: 'TRAVEL' as const,
      amountCents: 4_000,
      occurredOn: '2026-10-02',
      state: 'SETTLED' as const,
    };

    it('snapshots the equal default split and logs the entry', async () => {
      await service.create('b1', member, { ...dto, handledById: 'u2' });
      const args = createCall(0) as {
        data: Record<string, unknown>;
      };
      expect(args.data).toMatchObject({
        kind: 'EXPENSE',
        handledById: 'u2',
        createdById: 'u2',
        occurredOn: new Date('2026-10-02T00:00:00.000Z'),
        splits: {
          create: [
            { userId: 'u1', shareBps: 5000 },
            { userId: 'u2', shareBps: 5000 },
          ],
        },
      });
      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'FINANCE_ENTRY_ADDED' }),
      });
    });

    it('uses the saved split once there is one', async () => {
      prisma.splitShare.findMany.mockResolvedValue([
        { userId: null, shareBps: 2000 },
        { userId: 'u1', shareBps: 8000 },
      ]);
      await service.create('b1', admin, dto);
      const args = createCall(0) as {
        data: { splits: { create: unknown[] } };
      };
      expect(args.data.splits.create).toEqual([
        { userId: null, shareBps: 2000 },
        { userId: 'u1', shareBps: 8000 },
      ]);
    });

    it('stops a member booking money to someone else’s pocket', async () => {
      await expect(
        service.create('b1', member, { ...dto, handledById: 'u1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('stops a member carving up the split', async () => {
      await expect(
        service.create('b1', member, {
          ...dto,
          splits: [{ userId: 'u2', shareBps: 10_000 }],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a handler who is not on the board', async () => {
      prisma.membership.findMany.mockResolvedValueOnce([]);
      await expect(
        service.create('b1', admin, { ...dto, handledById: 'u9' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update and void', () => {
    it('lets a member change only what they logged', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(
        row({ createdById: 'u1' }),
      );
      await expect(
        service.update('b1', member, 'f1', { amountCents: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.void('b1', member, 'f1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lets a member void their own entry', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(
        row({ createdById: 'u2' }),
      );
      prisma.financeEntry.update.mockResolvedValue(row({ state: 'VOID' }));
      const result = await service.void('b1', member, 'f1');
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { state: 'VOID' } }),
      );
      expect(result.state).toBe('VOID');
    });

    it('refuses a category from the other side once merged with the row', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(row());
      await expect(
        service.update('b1', admin, 'f1', { category: 'GEAR' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('leaves a void entry alone', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(row({ state: 'VOID' }));
      await expect(
        service.update('b1', admin, 'f1', { amountCents: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('admin-only', () => {
    it('keeps splits, payouts and settling with admins', async () => {
      await expect(
        service.setSplit('b1', member, {
          shares: [{ userId: 'u2', shareBps: 10_000 }],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.createPayout('b1', member, {
          userId: 'u2',
          amountCents: 100,
          paidOn: '2026-10-02',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.settleShow('b1', member, 'e1', {
          occurredOn: '2026-10-02',
          lines: [],
          receivedIds: ['f1'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('settleShow', () => {
    beforeEach(() => {
      prisma.event.findFirst.mockResolvedValue({
        id: 'e1',
        title: 'The Echo',
        startsAt: new Date('2026-10-02T03:00:00Z'),
      });
      prisma.financeEntry.findMany.mockResolvedValue([]);
    });

    it('refuses fees that are not this show’s expected ones', async () => {
      prisma.financeEntry.count.mockResolvedValue(0);
      await expect(
        service.settleShow('b1', admin, 'e1', {
          occurredOn: '2026-10-02',
          lines: [],
          receivedIds: ['f1'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('writes the lines against the show and marks fees received', async () => {
      prisma.financeEntry.count.mockResolvedValue(1);
      await service.settleShow('b1', admin, 'e1', {
        occurredOn: '2026-10-02',
        lines: [
          {
            kind: 'INCOME',
            category: 'MERCH_SALES',
            amountCents: 12_000,
            handledById: 'u2',
          },
          { kind: 'EXPENSE', category: 'TRAVEL', amountCents: 3_000 },
        ],
        receivedIds: ['f1'],
      });
      expect(prisma.financeEntry.create).toHaveBeenCalledTimes(2);
      expect(createCall(0)).toMatchObject({
        data: { eventId: 'e1', state: 'SETTLED', handledById: 'u2' },
      });
      expect(prisma.financeEntry.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['f1'] }, boardId: 'b1' },
        data: { state: 'SETTLED' },
      });
      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'SHOW_SETTLED' }),
      });
    });
  });

  describe('summary', () => {
    it('totals the range, balances all time, and lists unpaid shows', async () => {
      prisma.financeEntry.findMany.mockResolvedValue([
        row({ occurredOn: new Date('2026-09-01T00:00:00Z') }),
        row({ id: 'f2', amountCents: 20_000 }),
        row({
          id: 'f3',
          state: 'EXPECTED',
          eventId: 'e1',
          amountCents: 15_000,
        }),
      ]);
      prisma.payout.findMany.mockResolvedValue([
        { userId: 'u2', amountCents: 5_000 },
      ]);
      prisma.event.findMany.mockResolvedValue([
        {
          id: 'e1',
          title: 'The Echo',
          startsAt: new Date('2026-10-20T03:00:00Z'),
        },
      ]);

      const summary = await service.summary('b1', member, {
        from: '2026-10-01',
      });
      expect(summary.totals.incomeCents).toBe(20_000);
      expect(summary.totals.expectedCents).toBe(15_000);
      const ben = summary.balances.members.find((m) => m.userId === 'u2');
      expect(ben?.balanceCents).toBe(30_000 - 5_000);
      expect(summary.unpaidShows).toEqual([
        {
          eventId: 'e1',
          title: 'The Echo',
          startsAt: '2026-10-20T03:00:00.000Z',
          expectedCents: 15_000,
        },
      ]);
    });
  });
});
