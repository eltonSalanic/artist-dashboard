import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  can,
  canEditEntry,
  categoryKind,
  categoryLabel,
  computeBalances,
  formatMoney,
  ledgerTotals,
  paybackStatus,
  showSettlement,
  type Action,
  type BoardRole,
  type CreateFinanceEntryDto,
  type FinanceEntryDto,
  type FinanceEntryQueryDto,
  type FinanceMemberRef,
  type FinanceSummaryDto,
  type FinanceSummaryQueryDto,
  type LedgerEntry,
  type ShowSettlementDto,
  type UpdateFinanceEntryDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { NotificationsService } from '../notifications/notifications.service';

const entryInclude = {
  event: { select: { title: true } },
  _count: { select: { receipts: true } },
} satisfies Prisma.FinanceEntryInclude;

type EntryRow = Prisma.FinanceEntryGetPayload<{ include: typeof entryInclude }>;

/** The caller, as the guard resolved them for this board. */
export interface FinanceActor {
  userId: string;
  role: BoardRole;
}

/** `YYYY-MM-DD` → the Date Prisma writes to a `@db.Date` column. */
const toDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const fromDate = (date: Date) => date.toISOString().slice(0, 10);

const entryLabel = (entry: { description: string; category: string }) =>
  entry.description || categoryLabel(entry.category);

/** Out of a member's pocket, counted, and not paid back yet. */
const isOwedRow = (row: EntryRow) => paybackStatus(toLedger(row)) === 'owed';

/**
 * The band's books: a ledger of what came in and what went out. A member is
 * owed money only for an expense they paid out of pocket, until an admin pays
 * them back from the band fund. Paying back locks the entry for everyone until
 * an admin undoes it.
 */
@Injectable()
export class FinancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- Entries ----

  async list(
    boardId: string,
    actor: FinanceActor,
    query: FinanceEntryQueryDto,
  ) {
    this.require(actor, 'finance.view');
    const rows = await this.prisma.financeEntry.findMany({
      where: {
        boardId,
        ...(query.includeVoid ? {} : { state: { not: 'VOID' } }),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.eventId ? { eventId: query.eventId } : {}),
        ...(query.from || query.to
          ? {
              occurredOn: {
                ...(query.from ? { gte: toDate(query.from) } : {}),
                ...(query.to ? { lte: toDate(query.to) } : {}),
              },
            }
          : {}),
      },
      include: entryInclude,
      orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toEntryDto);
  }

  async findOne(boardId: string, actor: FinanceActor, entryId: string) {
    this.require(actor, 'finance.view');
    return toEntryDto(await this.getEntry(boardId, entryId));
  }

  async create(
    boardId: string,
    actor: FinanceActor,
    dto: CreateFinanceEntryDto,
  ) {
    this.require(actor, 'finance.create');
    // Income goes into the band fund; nobody is owed for it.
    const handledById =
      dto.kind === 'EXPENSE' ? (dto.handledById ?? null) : null;
    this.assertMemberMayShape(actor, { handledById });
    if (dto.eventId) await this.assertEventInBoard(boardId, dto.eventId);
    if (handledById) await this.assertMembers(boardId, [handledById]);

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.financeEntry.create({
        data: {
          boardId,
          kind: dto.kind,
          state: dto.state,
          category: dto.category,
          amountCents: dto.amountCents,
          occurredOn: toDate(dto.occurredOn),
          counterparty: dto.counterparty ?? null,
          description: dto.description ?? '',
          note: dto.note ?? '',
          eventId: dto.eventId ?? null,
          handledById,
          createdById: actor.userId,
        },
        include: entryInclude,
      });
      await this.logEntry(tx, boardId, actor.userId, created);
      if (isOwedRow(created)) {
        await this.tellAdminsOwed(tx, created, actor.userId, true);
      }
      return created;
    });
    return toEntryDto(entry);
  }

  async update(
    boardId: string,
    actor: FinanceActor,
    entryId: string,
    dto: UpdateFinanceEntryDto,
  ) {
    const before = await this.getEntry(boardId, entryId);
    this.assertMayEdit(actor, before);
    if (before.state === 'VOID') {
      throw new BadRequestException('A void entry cannot be changed');
    }

    const kind = dto.kind ?? before.kind;
    const category = dto.category ?? before.category;
    const handledById =
      kind === 'EXPENSE'
        ? dto.handledById !== undefined
          ? dto.handledById
          : before.handledById
        : null;
    if (handledById !== before.handledById) {
      this.assertMemberMayShape(actor, { handledById });
    }
    const state = dto.state ?? before.state;
    if (categoryKind(category) !== kind) {
      throw new BadRequestException(
        'That category belongs to the other kind of entry',
      );
    }
    if (state === 'EXPECTED' && kind !== 'INCOME') {
      throw new BadRequestException('Only income can be expected');
    }
    if (dto.eventId) await this.assertEventInBoard(boardId, dto.eventId);
    if (handledById && handledById !== before.handledById) {
      await this.assertMembers(boardId, [handledById]);
    }

    const entry = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financeEntry.update({
        where: { id: entryId },
        data: {
          kind,
          category,
          state,
          handledById,
          ...(dto.amountCents !== undefined
            ? { amountCents: dto.amountCents }
            : {}),
          ...(dto.occurredOn ? { occurredOn: toDate(dto.occurredOn) } : {}),
          ...(dto.counterparty !== undefined
            ? { counterparty: dto.counterparty }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          ...(dto.eventId !== undefined ? { eventId: dto.eventId } : {}),
        },
        include: entryInclude,
      });
      if (isOwedRow(updated)) {
        // Admins' inbox rows restate the entry, so an edit refreshes them. A
        // push only goes out when someone is newly owed: a member fixing a
        // typo shouldn't buzz every admin's phone again.
        const fresh =
          !isOwedRow(before) || before.handledById !== updated.handledById;
        await this.tellAdminsOwed(tx, updated, actor.userId, fresh);
      } else if (isOwedRow(before)) {
        await this.dropOwedRows(tx, [entryId]);
      }
      return updated;
    });
    return toEntryDto(entry);
  }

  /** The books keep the row; it just stops counting. */
  async void(boardId: string, actor: FinanceActor, entryId: string) {
    const before = await this.getEntry(boardId, entryId);
    this.assertMayEdit(actor, before);
    const entry = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financeEntry.update({
        where: { id: entryId },
        data: { state: 'VOID' },
        include: entryInclude,
      });
      // Nobody is owed for it any more.
      await this.dropOwedRows(tx, [entryId]);
      return updated;
    });
    return toEntryDto(entry);
  }

  // ---- Paybacks ----

  /**
   * An admin pays a member back for one out-of-pocket expense, from the band
   * fund. The fund can go below zero; that's the band's business. The entry
   * locks until the payback is undone, and the member hears about it.
   */
  async payBack(boardId: string, actor: FinanceActor, entryId: string) {
    this.require(actor, 'finance.manage');
    const before = await this.getEntry(boardId, entryId);
    if (!isOwedRow(before)) {
      throw new BadRequestException(
        before.paidBackAt
          ? 'That was already paid back'
          : 'Nobody is owed for that entry',
      );
    }
    const entry = await this.prisma.$transaction(async (tx) => {
      const [updated] = await this.markPaidBack(tx, [before], actor.userId);
      return updated;
    });
    return toEntryDto(entry);
  }

  /** Pays a member back for everything the band still owes them, at once. */
  async payBackMember(boardId: string, actor: FinanceActor, userId: string) {
    this.require(actor, 'finance.manage');
    const owed = await this.prisma.financeEntry.findMany({
      where: {
        boardId,
        kind: 'EXPENSE',
        state: 'SETTLED',
        handledById: userId,
        paidBackAt: null,
      },
      include: entryInclude,
      orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
    });
    if (owed.length === 0) {
      throw new BadRequestException('The band doesn’t owe them anything');
    }
    const entries = await this.prisma.$transaction((tx) =>
      this.markPaidBack(tx, owed, actor.userId),
    );
    return entries.map(toEntryDto);
  }

  /**
   * Takes a payback back, for when an admin tapped the wrong one. The member
   * is owed again and the entry can be edited again.
   */
  async undoPayBack(boardId: string, actor: FinanceActor, entryId: string) {
    this.require(actor, 'finance.manage');
    const before = await this.getEntry(boardId, entryId);
    if (!before.paidBackAt) {
      throw new BadRequestException('That hasn’t been paid back');
    }
    const entry = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financeEntry.update({
        where: { id: entryId },
        data: { paidBackAt: null, paidBackById: null },
        include: entryInclude,
      });
      await tx.mentionNotification.deleteMany({
        where: { entryId, kind: 'PAID_BACK' },
      });
      if (isOwedRow(updated)) {
        await this.tellAdminsOwed(tx, updated, actor.userId, false);
      }
      return updated;
    });
    return toEntryDto(entry);
  }

  // ---- Reports ----

  async summary(
    boardId: string,
    actor: FinanceActor,
    query: FinanceSummaryQueryDto,
  ): Promise<FinanceSummaryDto> {
    this.require(actor, 'finance.view');
    const [rows, currency] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where: { boardId, state: { not: 'VOID' } },
        include: entryInclude,
      }),
      this.currency(boardId),
    ]);
    const all = rows.map(toLedger);
    const inRange = all.filter(
      (e) =>
        (!query.from || e.occurredOn >= query.from) &&
        (!query.to || e.occurredOn <= query.to),
    );
    const balances = computeBalances(all);

    return {
      currency,
      totals: ledgerTotals(inRange),
      balances,
      members: await this.members(
        boardId,
        balances.members.map((m) => m.userId),
      ),
      owed: rows
        .filter(isOwedRow)
        .map(toEntryDto)
        .sort(
          (a, b) =>
            b.occurredOn.localeCompare(a.occurredOn) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    };
  }

  async showSettlement(
    boardId: string,
    actor: FinanceActor,
    eventId: string,
  ): Promise<ShowSettlementDto> {
    this.require(actor, 'finance.view');
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
      select: { id: true, title: true, startsAt: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    const [rows, currency] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where: { boardId, eventId, state: { not: 'VOID' } },
        include: entryInclude,
        orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
      }),
      this.currency(boardId),
    ]);
    return {
      currency,
      event: { ...event, startsAt: event.startsAt.toISOString() },
      entries: rows.map(toEntryDto),
      ...showSettlement(rows.map(toLedger)),
      members: await this.members(
        boardId,
        rows.flatMap((r) => (r.handledById ? [r.handledById] : [])),
      ),
    };
  }

  private require(actor: FinanceActor, action: Action) {
    if (!can(actor.role, action)) {
      throw new ForbiddenException('Only board admins can do that');
    }
  }

  /**
   * Members log their own money: they can't say someone else paid for
   * something, which would have the band owe that person. Admins can.
   */
  private assertMemberMayShape(
    actor: FinanceActor,
    dto: { handledById?: string | null },
  ) {
    if (can(actor.role, 'finance.manage')) return;
    if (dto.handledById && dto.handledById !== actor.userId) {
      throw new ForbiddenException(
        'You can only log money you paid yourself',
      );
    }
  }

  /** The shared `canEditEntry` rule, with the reason when it says no. */
  private assertMayEdit(actor: FinanceActor, entry: EntryRow) {
    if (entry.paidBackAt) {
      throw new ForbiddenException(
        'This was paid back, so it’s locked. An admin can undo the payback to change it.',
      );
    }
    const allowed =
      can(actor.role, 'finance.create') &&
      canEditEntry(
        {
          handledById: entry.handledById,
          createdById: entry.createdById,
          paidBackAt: null,
        },
        actor.userId,
        can(actor.role, 'finance.manage'),
      );
    if (!allowed) {
      throw new ForbiddenException(
        'Only an admin or the member who paid can change this',
      );
    }
  }

  private async getEntry(boardId: string, entryId: string) {
    const entry = await this.prisma.financeEntry.findFirst({
      where: { id: entryId, boardId },
      include: entryInclude,
    });
    if (!entry) throw new NotFoundException('Entry not found');
    return entry;
  }

  private async currency(boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { currency: true },
    });
    return board?.currency ?? 'USD';
  }

  /** Today's members plus anyone the books still mention. */
  private async members(
    boardId: string,
    alsoIds: string[],
  ): Promise<FinanceMemberRef[]> {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { memberships: { some: { boardId } } },
          ...(alsoIds.length ? [{ id: { in: alsoIds } }] : []),
        ],
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
    return users;
  }

  private async assertMembers(boardId: string, userIds: string[]) {
    const unique = [...new Set(userIds)];
    const found = await this.prisma.membership.findMany({
      where: { boardId, userId: { in: unique } },
      select: { user: { select: { id: true, displayName: true } } },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('Everyone named must be on this board');
    }
    return found.map((m) => m.user);
  }

  private async assertEventInBoard(boardId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');
  }

  /**
   * Puts an out-of-pocket expense in front of every admin, as a reminder that
   * the band owes the member who paid: an inbox row each, and when `fresh`, a
   * push and email. Rows are rewritten rather than updated so they always
   * restate the entry as it stands. Nobody is told about their own expense,
   * or about one they just logged or changed themselves.
   */
  private async tellAdminsOwed(
    tx: Prisma.TransactionClient,
    entry: EntryRow,
    actorId: string,
    fresh: boolean,
  ) {
    const [admins, payee, board] = await Promise.all([
      tx.membership.findMany({
        where: { boardId: entry.boardId, role: 'ADMIN' },
        select: { userId: true },
      }),
      tx.user.findUnique({
        where: { id: entry.handledById! },
        select: { displayName: true },
      }),
      tx.board.findUnique({
        where: { id: entry.boardId },
        select: { currency: true },
      }),
    ]);
    const recipients = admins
      .map((m) => m.userId)
      .filter((id) => id !== actorId && id !== entry.handledById);
    await this.dropOwedRows(tx, [entry.id]);
    if (recipients.length === 0) return;

    const payeeName = payee?.displayName ?? 'A bandmate';
    const label = entryLabel(entry);
    const amount = formatMoney(entry.amountCents, board?.currency ?? 'USD');
    await tx.mentionNotification.createMany({
      data: recipients.map((userId) => ({
        boardId: entry.boardId,
        userId,
        kind: 'PAYBACK' as const,
        entryId: entry.id,
        actorName: payeeName,
        taskTitle: `${label} · ${amount}`,
        excerpt: entry.note,
      })),
    });
    if (!fresh) return;

    const stamp = entry.updatedAt.getTime();
    await this.notifications.queue(
      tx,
      recipients.map((userId) => ({
        boardId: entry.boardId,
        userId,
        category: 'APPROVALS' as const,
        template: 'expense-owed',
        dedupeKey: `owed:${entry.id}:${stamp}:${userId}`,
        payload: {
          entryId: entry.id,
          actorName: payeeName,
          label,
          amount,
          note: entry.note,
          eventTitle: entry.event?.title ?? '',
        },
      })),
    );
  }

  /**
   * Marks owed entries, all paid by one member, as paid back by `actorId`:
   * the admins' reminders go, the member gets one inbox row and one push for
   * the lot, and the activity feed says who paid whom.
   */
  private async markPaidBack(
    tx: Prisma.TransactionClient,
    entries: EntryRow[],
    actorId: string,
  ): Promise<EntryRow[]> {
    const ids = entries.map((e) => e.id);
    const { boardId, handledById: payeeId } = entries[0];
    const now = new Date();
    await tx.financeEntry.updateMany({
      where: { id: { in: ids } },
      data: { paidBackAt: now, paidBackById: actorId },
    });
    await this.dropOwedRows(tx, ids);
    const updated = await tx.financeEntry.findMany({
      where: { id: { in: ids } },
      include: entryInclude,
      orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
    });

    const [actor, payee, board] = await Promise.all([
      tx.user.findUnique({
        where: { id: actorId },
        select: { displayName: true },
      }),
      tx.user.findUnique({
        where: { id: payeeId! },
        select: { displayName: true },
      }),
      tx.board.findUnique({
        where: { id: boardId },
        select: { currency: true },
      }),
    ]);
    const currency = board?.currency ?? 'USD';
    const actorName = actor?.displayName ?? 'An admin';
    const total = updated.reduce((sum, e) => sum + e.amountCents, 0);
    const amount = formatMoney(total, currency);
    const single = updated.length === 1 ? updated[0] : null;
    const label = single
      ? entryLabel(single)
      : `${updated.length} expenses`;

    await this.activity.log(tx, {
      boardId,
      type: 'EXPENSE_PAID_BACK',
      actorId,
      meta: {
        entryIds: ids,
        memberId: payeeId,
        memberName: payee?.displayName ?? 'a member',
        label,
        amount,
      },
    });

    if (payeeId && payeeId !== actorId) {
      await tx.mentionNotification.create({
        data: {
          boardId,
          userId: payeeId,
          kind: 'PAID_BACK',
          // A single entry opens; a batch has nothing one row could point at.
          entryId: single?.id ?? null,
          actorName,
          // The headline is written here so every client shows the same one.
          taskTitle: `Paid back: ${label} · ${amount}`,
          excerpt: `${actorName} paid you back from the band fund.`,
        },
      });
      await this.notifications.queue(tx, {
        boardId,
        userId: payeeId,
        category: 'APPROVALS',
        template: 'expense-paid-back',
        dedupeKey: `paid-back:${ids.join(',')}:${now.getTime()}`,
        payload: { entryId: single?.id ?? '', actorName, label, amount },
      });
    }
    return updated;
  }

  private async dropOwedRows(tx: Prisma.TransactionClient, entryIds: string[]) {
    await tx.mentionNotification.deleteMany({
      where: { entryId: { in: entryIds }, kind: 'PAYBACK' },
    });
  }

  private async logEntry(
    tx: Prisma.TransactionClient,
    boardId: string,
    actorId: string,
    entry: EntryRow,
  ) {
    const board = await tx.board.findUnique({
      where: { id: boardId },
      select: { currency: true },
    });
    await this.activity.log(tx, {
      boardId,
      type: 'FINANCE_ENTRY_ADDED',
      actorId,
      meta: {
        entryId: entry.id,
        kind: entry.kind,
        label: entryLabel(entry),
        amount: formatMoney(entry.amountCents, board?.currency ?? 'USD'),
        eventId: entry.eventId,
      },
    });
  }
}

function toLedger(row: EntryRow): LedgerEntry {
  return {
    kind: row.kind,
    state: row.state,
    amountCents: row.amountCents,
    category: row.category,
    occurredOn: fromDate(row.occurredOn),
    handledById: row.handledById,
    paidBackAt: row.paidBackAt?.toISOString() ?? null,
  };
}

function toEntryDto(row: EntryRow): FinanceEntryDto {
  return {
    id: row.id,
    boardId: row.boardId,
    kind: row.kind,
    state: row.state,
    category: row.category,
    amountCents: row.amountCents,
    occurredOn: fromDate(row.occurredOn),
    counterparty: row.counterparty,
    description: row.description,
    note: row.note,
    eventId: row.eventId,
    eventTitle: row.event?.title ?? null,
    handledById: row.handledById,
    createdById: row.createdById,
    paidBackAt: row.paidBackAt?.toISOString() ?? null,
    paidBackById: row.paidBackById,
    receiptCount: row._count.receipts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
