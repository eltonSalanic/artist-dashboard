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
    paidBackAt: null,
    paidBackById: null,
    createdAt: new Date('2026-10-01T12:00:00Z'),
    updatedAt: new Date('2026-10-01T12:00:00Z'),
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

  const owed = row({
    kind: 'EXPENSE',
    category: 'TRAVEL',
    handledById: 'u2',
    createdById: 'u2',
  });
  const paidBack = row({
    ...owed,
    paidBackAt: new Date('2026-10-03T00:00:00Z'),
    paidBackById: 'u1',
  });
  const dto = {
    kind: 'EXPENSE' as const,
    category: 'TRAVEL' as const,
    amountCents: 4_000,
    occurredOn: '2026-10-02',
    state: 'SETTLED' as const,
  };

  describe('create', () => {
    it('writes the entry, counted at once, and logs it', async () => {
      await service.create('b1', member, { ...dto, handledById: 'u2' });
      const args = createCall(0) as {
        data: Record<string, unknown>;
      };
      expect(args.data).toMatchObject({
        kind: 'EXPENSE',
        state: 'SETTLED',
        handledById: 'u2',
        createdById: 'u2',
        occurredOn: new Date('2026-10-02T00:00:00.000Z'),
      });
      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'FINANCE_ENTRY_ADDED' }),
      });
    });

    it('never records who holds income', async () => {
      await service.create('b1', member, {
        ...dto,
        kind: 'INCOME',
        category: 'MERCH_SALES',
        handledById: 'u2',
      });
      expect(createCall(0)).toMatchObject({ data: { handledById: null } });
      expect(prisma.mentionNotification.createMany).not.toHaveBeenCalled();
    });

    it('reminds every other admin that the band owes the member', async () => {
      prisma.financeEntry.create.mockResolvedValue(owed);
      await service.create('b1', member, { ...dto, handledById: 'u2' });
      // Both members come back as admins from the mock; the payee is skipped.
      expect(prisma.mentionNotification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            userId: 'u1',
            kind: 'PAYBACK',
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
          template: 'expense-owed',
          dedupeKey: expect.stringMatching(/^owed:f1:\d+:u1$/),
          payload: expect.objectContaining({ actorName: 'Ben', amount: '$400.00' }),
        }),
      ]);
    });

    it('tells nobody about a band-account expense', async () => {
      await service.create('b1', member, dto);
      expect(prisma.mentionNotification.createMany).not.toHaveBeenCalled();
      expect(notifications.queue).not.toHaveBeenCalled();
    });

    it('stops a member saying someone else paid', async () => {
      await expect(
        service.create('b1', member, { ...dto, handledById: 'u1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a payer who is not on the board', async () => {
      prisma.membership.findMany.mockResolvedValueOnce([]);
      await expect(
        service.create('b1', admin, { ...dto, handledById: 'u9' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update and void', () => {
    it('lets a member change only what they paid for or logged', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(
        row({ createdById: 'u1' }),
      );
      await expect(
        service.update('b1', member, 'f1', { amountCents: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.void('b1', member, 'f1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      // An admin logged it, but the member paid: theirs to fix.
      prisma.financeEntry.findFirst.mockResolvedValue(
        row({ ...owed, createdById: 'u1' }),
      );
      prisma.financeEntry.update.mockResolvedValue(owed);
      await service.update('b1', member, 'f1', { amountCents: 1 });
      expect(prisma.financeEntry.update).toHaveBeenCalled();
    });

    it('lets a member void their own entry, and drops the reminders', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(owed);
      prisma.financeEntry.update.mockResolvedValue(row({ state: 'VOID' }));
      const result = await service.void('b1', member, 'f1');
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { state: 'VOID' } }),
      );
      expect(prisma.mentionNotification.deleteMany).toHaveBeenCalledWith({
        where: { entryId: { in: ['f1'] }, kind: 'PAYBACK' },
      });
      expect(result.state).toBe('VOID');
    });

    it('locks a paid-back entry for everyone, admins too', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(paidBack);
      for (const actor of [member, admin]) {
        await expect(
          service.update('b1', actor, 'f1', { amountCents: 1 }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.void('b1', actor, 'f1')).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      }
    });

    it('refreshes the admins’ reminders on an edit, without a push', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(owed);
      prisma.financeEntry.update.mockResolvedValue(owed);
      await service.update('b1', member, 'f1', { note: 'typo' });
      expect(prisma.mentionNotification.createMany).toHaveBeenCalled();
      expect(notifications.queue).not.toHaveBeenCalled();
    });

    it('pushes when an edit makes the band owe someone', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(
        row({ kind: 'EXPENSE', category: 'TRAVEL', createdById: 'u2' }),
      );
      prisma.financeEntry.update.mockResolvedValue(owed);
      await service.update('b1', member, 'f1', { handledById: 'u2' });
      expect(notifications.queue).toHaveBeenCalledWith(prisma, [
        expect.objectContaining({ template: 'expense-owed' }),
      ]);
    });

    it('drops the reminders when it moves to the band account', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(owed);
      prisma.financeEntry.update.mockResolvedValue(row({ ...owed, handledById: null }));
      await service.update('b1', member, 'f1', { handledById: null });
      expect(prisma.mentionNotification.deleteMany).toHaveBeenCalledWith({
        where: { entryId: { in: ['f1'] }, kind: 'PAYBACK' },
      });
      expect(prisma.mentionNotification.createMany).not.toHaveBeenCalled();
    });

    it('clears who paid when an expense becomes income', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(owed);
      prisma.financeEntry.update.mockResolvedValue(row());
      await service.update('b1', admin, 'f1', {
        kind: 'INCOME',
        category: 'MERCH_SALES',
      });
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ handledById: null }),
        }),
      );
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

  describe('paying back', () => {
    beforeEach(() => {
      prisma.financeEntry.findMany.mockResolvedValue([paidBack]);
    });

    it('marks it paid back, clears the reminders and tells the member', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(owed);
      const result = await service.payBack('b1', admin, 'f1');
      expect(prisma.financeEntry.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['f1'] } },
        data: { paidBackAt: expect.any(Date), paidBackById: 'u1' },
      });
      expect(prisma.mentionNotification.deleteMany).toHaveBeenCalledWith({
        where: { entryId: { in: ['f1'] }, kind: 'PAYBACK' },
      });
      expect(prisma.mentionNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u2',
          kind: 'PAID_BACK',
          entryId: 'f1',
          actorName: 'Ana',
          taskTitle: 'Paid back: Travel and fuel · $400.00',
        }),
      });
      expect(notifications.queue).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          userId: 'u2',
          template: 'expense-paid-back',
          payload: expect.objectContaining({ amount: '$400.00' }),
        }),
      );
      expect(prisma.activity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'EXPENSE_PAID_BACK',
          meta: expect.objectContaining({ memberName: 'Ben', amount: '$400.00' }),
        }),
      });
      expect(result.paidBackAt).toBe('2026-10-03T00:00:00.000Z');
    });

    it('is for admins, and only for what is owed', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(owed);
      await expect(service.payBack('b1', member, 'f1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      for (const entry of [paidBack, row()]) {
        prisma.financeEntry.findFirst.mockResolvedValue(entry);
        await expect(service.payBack('b1', admin, 'f1')).rejects.toBeInstanceOf(
          BadRequestException,
        );
      }
    });

    it('pays back everything a member is owed, with one alert', async () => {
      const two = [owed, row({ ...owed, id: 'f2', amountCents: 1_000 })];
      prisma.financeEntry.findMany
        .mockResolvedValueOnce(two)
        .mockResolvedValueOnce(two);
      await service.payBackMember('b1', admin, 'u2');
      expect(prisma.financeEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['f1', 'f2'] } } }),
      );
      expect(prisma.mentionNotification.create).toHaveBeenCalledTimes(1);
      expect(prisma.mentionNotification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entryId: null,
          taskTitle: 'Paid back: 2 expenses · $410.00',
        }),
      });
      expect(notifications.queue).toHaveBeenCalledTimes(1);
    });

    it('says so when nothing is owed', async () => {
      prisma.financeEntry.findMany.mockResolvedValueOnce([]);
      await expect(
        service.payBackMember('b1', admin, 'u2'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('undoes a payback: owed again, and the reminders come back quietly', async () => {
      prisma.financeEntry.findFirst.mockResolvedValue(paidBack);
      prisma.financeEntry.update.mockResolvedValue(owed);
      await service.undoPayBack('b1', admin, 'f1');
      expect(prisma.financeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paidBackAt: null, paidBackById: null },
        }),
      );
      expect(prisma.mentionNotification.deleteMany).toHaveBeenCalledWith({
        where: { entryId: 'f1', kind: 'PAID_BACK' },
      });
      expect(notifications.queue).not.toHaveBeenCalled();
      prisma.financeEntry.findFirst.mockResolvedValue(owed);
      await expect(
        service.undoPayBack('b1', admin, 'f1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('summary', () => {
    it('totals the range, and lists what the band owes all time', async () => {
      prisma.financeEntry.findMany.mockResolvedValue([
        row({ occurredOn: new Date('2026-09-01T00:00:00Z') }),
        row({ id: 'f2', amountCents: 20_000 }),
        row({
          id: 'f3',
          state: 'EXPECTED',
          eventId: 'e1',
          amountCents: 15_000,
        }),
        owed,
        row({ ...paidBack, id: 'f5', amountCents: 1_000 }),
      ]);
      const summary = await service.summary('b1', member, {
        from: '2026-10-01',
      });
      expect(summary.totals.incomeCents).toBe(20_000);
      expect(summary.totals.expenseCents).toBe(41_000);
      expect(summary.totals.expectedCents).toBe(15_000);
      expect(summary.balances.members).toEqual([
        { userId: 'u2', paidCents: 41_000, paidBackCents: 1_000, owedCents: 40_000 },
      ]);
      // Income, less the payback; the unpaid expense is still Ben's money.
      expect(summary.balances.bandFundCents).toBe(59_000);
      expect(summary.owed.map((e) => e.id)).toEqual(['f1']);
    });
  });
});
