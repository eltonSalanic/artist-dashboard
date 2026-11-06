import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FinancesService, type FinanceActor } from './finances.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    approvedById: null,
    approvedAt: null,
    decisionNote: '',
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
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    mentionNotification: {
      createMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
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

  const notifications = { queue: jest.fn() };
  const service = new FinancesService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
    notifications as unknown as NotificationsService,
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
    prisma.user.findUnique.mockImplementation((args: { where: { id: string } }) =>
      Promise.resolve({ displayName: args.where.id === 'u1' ? 'Ana' : 'Ben' }),
    );
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
        state: 'PENDING',
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

    it('holds a member’s out-of-pocket expense for approval', async () => {
      await service.create('b1', member, { ...dto, handledById: 'u2' });
      expect(createCall(0)).toMatchObject({ data: { state: 'PENDING' } });
    });

    it('needs no approval for an admin’s own expense or collected income', async () => {
      await service.create('b1', admin, { ...dto, handledById: 'u1' });
      await service.create('b1', member, {
        ...dto,
        kind: 'INCOME',
        category: 'MERCH_SALES',
        handledById: 'u2',
      });
      await service.create('b1', member, dto);
      expect(createCall(0)).toMatchObject({ data: { state: 'SETTLED' } });
      expect(createCall(1)).toMatchObject({ data: { state: 'SETTLED' } });
      expect(createCall(2)).toMatchObject({ data: { state: 'SETTLED' } });
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

  describe('approval', () => {
    const pending = row({
      kind: 'EXPENSE',
      category: 'TRAVEL',
      state: 'PENDING',
      handledById: 'u2',
      createdById: 'u2',
    });

    it('settles a pending expense and records who approved it', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(pending);
      prisma.financeEntry.update.mockResolvedValue(pending);
      await service.approve('b1', admin, 'f1');
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            state: 'SETTLED',
            approvedById: 'u1',
            approvedAt: expect.any(Date),
            decisionNote: '',
          },
        }),
      );
    });

    it('asks every other admin when a member’s expense lands pending', async () => {
      prisma.financeEntry.create.mockResolvedValue(pending);
      await service.create('b1', member, {
        kind: 'EXPENSE',
        category: 'TRAVEL',
        amountCents: 4_000,
        occurredOn: '2026-10-02',
        state: 'SETTLED',
        handledById: 'u2',
      });
      // Both members come back as admins from the mock; the actor is skipped.
      expect(prisma.mentionNotification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: 'u1',
            kind: 'APPROVAL',
            entryId: 'f1',
            actorName: 'Ben',
            taskTitle: 'Travel and fuel · $400.00',
          }),
        ],
      });
      expect(notifications.queue).toHaveBeenCalledWith(prisma, [
        expect.objectContaining({
          userId: 'u1',
          category: 'APPROVALS',
          template: 'expense-approval',
          dedupeKey: expect.stringMatching(/^approval:f1:\d+:u1$/),
          payload: expect.objectContaining({ actorName: 'Ben', amount: '$400.00' }),
        }),
      ]);
    });

    it('tells the member when their expense is approved, and clears the requests', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(pending);
      prisma.financeEntry.update.mockResolvedValue(pending);
      await service.approve('b1', admin, 'f1');
      expect(prisma.mentionNotification.deleteMany).toHaveBeenCalledWith({
        where: { entryId: 'f1', kind: 'APPROVAL' },
      });
      expect(prisma.mentionNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u2',
          kind: 'DECISION',
          actorName: 'Ana',
          taskTitle: 'Approved: Travel and fuel · $400.00',
        }),
      });
      expect(notifications.queue).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          userId: 'u2',
          template: 'expense-decided',
          payload: expect.objectContaining({ decision: 'APPROVED' }),
        }),
      );
    });

    it('sends a pending expense back with the admin’s note', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(pending);
      prisma.financeEntry.update.mockResolvedValue(
        row({ ...pending, state: 'REJECTED', decisionNote: 'Receipt?' }),
      );
      const result = await service.reject('b1', admin, 'f1', { note: 'Receipt?' });
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { state: 'REJECTED', decisionNote: 'Receipt?' },
        }),
      );
      expect(result.decisionNote).toBe('Receipt?');
      expect(prisma.mentionNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u2', kind: 'DECISION', excerpt: 'Receipt?' }),
      });
      expect(notifications.queue).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          payload: expect.objectContaining({ decision: 'REJECTED', note: 'Receipt?' }),
        }),
      );
    });

    it('only sends back what is pending, and only for admins', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(pending);
      await expect(
        service.reject('b1', member, 'f1', { note: '' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      prisma.financeEntry.findFirst.mockResolvedValue(row());
      await expect(
        service.reject('b1', admin, 'f1', { note: '' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('a member saving a sent-back expense resubmits it', async () => {
      const sentBack = row({ ...pending, state: 'REJECTED', decisionNote: 'Receipt?' });
      prisma.financeEntry.findFirst.mockResolvedValue(sentBack);
      prisma.financeEntry.update.mockResolvedValue(pending);
      await service.update('b1', member, 'f1', { note: 'Added the receipt' });
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: 'PENDING', decisionNote: '' }),
        }),
      );
      // A fresh request: the admins hear about it again.
      expect(notifications.queue).toHaveBeenCalledWith(prisma, [
        expect.objectContaining({ template: 'expense-approval' }),
      ]);
    });

    it('an edit while pending refreshes the admins’ inbox rows without a push', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(pending);
      prisma.financeEntry.update.mockResolvedValue(pending);
      await service.update('b1', member, 'f1', { note: 'typo' });
      expect(prisma.mentionNotification.createMany).toHaveBeenCalled();
      expect(notifications.queue).not.toHaveBeenCalled();
    });

    it('is for admins, and only for pending entries', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(pending);
      await expect(service.approve('b1', member, 'f1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      prisma.financeEntry.findFirst.mockResolvedValue(row());
      await expect(service.approve('b1', admin, 'f1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('keeps a member’s own edit pending, whatever state they send', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(pending);
      prisma.financeEntry.update.mockResolvedValue(pending);
      await service.update('b1', member, 'f1', {
        amountCents: 4_500,
        state: 'SETTLED',
      });
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: 'PENDING' }),
        }),
      );
    });

    it('sends a member’s settled entry back for approval when it becomes theirs', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(
        row({ kind: 'EXPENSE', category: 'TRAVEL', createdById: 'u2' }),
      );
      prisma.financeEntry.update.mockResolvedValue(pending);
      await service.update('b1', member, 'f1', { handledById: 'u2' });
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: 'PENDING' }),
        }),
      );
    });

    it('locks an approved expense to the member who logged it', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(
        row({
          kind: 'EXPENSE',
          category: 'TRAVEL',
          handledById: 'u2',
          createdById: 'u2',
          approvedById: 'u1',
          approvedAt: new Date('2026-10-03T00:00:00Z'),
        }),
      );
      prisma.financeEntry.update.mockResolvedValue(row());
      await expect(
        service.update('b1', member, 'f1', { amountCents: 9_000 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.void('b1', member, 'f1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await service.update('b1', admin, 'f1', { amountCents: 3_900 });
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: 'SETTLED', amountCents: 3_900 }),
        }),
      );
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
