import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  can,
  categoryKind,
  categoryLabel,
  computeBalances,
  formatMoney,
  isLockedFor,
  ledgerTotals,
  needsApproval,
  showSettlement,
  type Action,
  type BoardRole,
  type FinanceKind,
  type FinanceState,
  type CreateFinanceEntryDto,
  type CreatePayoutDto,
  type FinanceEntryDto,
  type FinanceEntryQueryDto,
  type FinanceMemberRef,
  type FinanceSummaryDto,
  type FinanceSummaryQueryDto,
  type LedgerEntry,
  type PayoutDto,
  type RejectFinanceEntryDto,
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
    this.assertMemberMayShape(actor, dto);
    if (dto.eventId) await this.assertEventInBoard(boardId, dto.eventId);
    if (dto.handledById) await this.assertMembers(boardId, [dto.handledById]);

    const state = needsApproval(
      { kind: dto.kind, handledById: dto.handledById ?? null },
      actor.userId,
      can(actor.role, 'finance.manage'),
    )
      ? 'PENDING'
      : dto.state;

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.financeEntry.create({
        data: {
          boardId,
          kind: dto.kind,
          state,
          category: dto.category,
          amountCents: dto.amountCents,
          occurredOn: toDate(dto.occurredOn),
          counterparty: dto.counterparty ?? null,
          description: dto.description ?? '',
          note: dto.note ?? '',
          eventId: dto.eventId ?? null,
          handledById: dto.handledById ?? null,
          createdById: actor.userId,
        },
        include: entryInclude,
      });
      await this.logEntry(tx, boardId, actor.userId, created);
      if (created.state === 'PENDING') {
        await this.askForApproval(tx, created, actor.userId, true);
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
    this.assertMemberMayShape(actor, dto);

    const kind = dto.kind ?? before.kind;
    const category = dto.category ?? before.category;
    const handledById =
      dto.handledById !== undefined ? dto.handledById : before.handledById;
    const state = this.nextState(actor, before, { kind, handledById }, dto);
    if (categoryKind(category) !== kind) {
      throw new BadRequestException(
        'That category belongs to the other kind of entry',
      );
    }
    if (state === 'EXPECTED' && kind !== 'INCOME') {
      throw new BadRequestException('Only income can be expected');
    }
    if (dto.eventId) await this.assertEventInBoard(boardId, dto.eventId);
    if (dto.handledById) await this.assertMembers(boardId, [dto.handledById]);

    const entry = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financeEntry.update({
        where: { id: entryId },
        data: {
          kind,
          category,
          state,
          // Resubmitting clears the admin's note: the member has acted on it.
          ...(before.state === 'REJECTED' && state !== 'REJECTED'
            ? { decisionNote: '' }
            : {}),
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
          ...(dto.handledById !== undefined
            ? { handledById: dto.handledById }
            : {}),
        },
        include: entryInclude,
      });
      if (updated.state === 'PENDING') {
        // Admins' inbox rows restate the entry, so an edit refreshes them. A
        // push only goes out when the request is new (or resubmitted) — a
        // member fixing a typo shouldn't buzz every admin's phone again.
        await this.askForApproval(
          tx,
          updated,
          actor.userId,
          before.state !== 'PENDING',
        );
      } else if (before.state === 'PENDING') {
        await this.dropApprovalRows(tx, entryId);
      }
      return updated;
    });
    return toEntryDto(entry);
  }

  /**
   * An admin accepts a member's out-of-pocket expense: from now on it counts,
   * the band owes the member for it, and the member can't change it any more.
   * A sent-back entry can be approved too, when the admin comes around.
   */
  async approve(boardId: string, actor: FinanceActor, entryId: string) {
    this.require(actor, 'finance.manage');
    const before = await this.getEntry(boardId, entryId);
    if (before.state !== 'PENDING' && before.state !== 'REJECTED') {
      throw new BadRequestException('That entry isn’t waiting for approval');
    }
    const entry = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financeEntry.update({
        where: { id: entryId },
        data: {
          state: 'SETTLED',
          approvedById: actor.userId,
          approvedAt: new Date(),
          decisionNote: '',
        },
        include: entryInclude,
      });
      await this.decide(tx, updated, actor.userId, 'APPROVED', '');
      return updated;
    });
    return toEntryDto(entry);
  }

  /**
   * An admin sends a member's expense back with a note. It stops counting, and
   * the member — who still owns it — can fix it and save, which asks again.
   */
  async reject(
    boardId: string,
    actor: FinanceActor,
    entryId: string,
    dto: RejectFinanceEntryDto,
  ) {
    this.require(actor, 'finance.manage');
    const before = await this.getEntry(boardId, entryId);
    if (before.state !== 'PENDING') {
      throw new BadRequestException('That entry isn’t waiting for approval');
    }
    const entry = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.financeEntry.update({
        where: { id: entryId },
        data: { state: 'REJECTED', decisionNote: dto.note },
        include: entryInclude,
      });
      await this.decide(tx, updated, actor.userId, 'REJECTED', dto.note);
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
      // Nothing left to approve.
      await this.dropApprovalRows(tx, entryId);
      return updated;
    });
    return toEntryDto(entry);
  }

  // ---- Payouts ----

  async listPayouts(boardId: string, actor: FinanceActor) {
    this.require(actor, 'finance.view');
    const rows = await this.prisma.payout.findMany({
      where: { boardId },
      orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toPayoutDto);
  }

  async createPayout(
    boardId: string,
    actor: FinanceActor,
    dto: CreatePayoutDto,
  ) {
    this.require(actor, 'finance.manage');
    const [member] = await this.assertMembers(boardId, [dto.userId]);
    const currency = await this.currency(boardId);
    const payout = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payout.create({
        data: {
          boardId,
          userId: dto.userId,
          amountCents: dto.amountCents,
          paidOn: toDate(dto.paidOn),
          note: dto.note ?? '',
          createdById: actor.userId,
        },
      });
      await this.activity.log(tx, {
        boardId,
        type: 'PAYOUT_RECORDED',
        actorId: actor.userId,
        meta: {
          payoutId: created.id,
          memberName: member.displayName,
          toBand: dto.amountCents < 0,
          amount: formatMoney(Math.abs(dto.amountCents), currency),
        },
      });
      return created;
    });
    return toPayoutDto(payout);
  }

  async removePayout(boardId: string, actor: FinanceActor, payoutId: string) {
    this.require(actor, 'finance.manage');
    const payout = await this.prisma.payout.findFirst({
      where: { id: payoutId, boardId },
    });
    if (!payout) throw new NotFoundException('Payment not found');
    await this.prisma.payout.delete({ where: { id: payoutId } });
    return { deleted: true };
  }

  // ---- Reports ----

  async summary(
    boardId: string,
    actor: FinanceActor,
    query: FinanceSummaryQueryDto,
  ): Promise<FinanceSummaryDto> {
    this.require(actor, 'finance.view');
    const [rows, payouts, currency] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where: { boardId, state: { not: 'VOID' } },
        include: entryInclude,
      }),
      this.prisma.payout.findMany({
        where: { boardId },
        select: { userId: true, amountCents: true },
      }),
      this.currency(boardId),
    ]);
    const all = rows.map(toLedger);
    const inRange = all.filter(
      (e) =>
        (!query.from || e.occurredOn >= query.from) &&
        (!query.to || e.occurredOn <= query.to),
    );
    const balances = computeBalances(all, payouts);

    return {
      currency,
      totals: ledgerTotals(inRange),
      balances,
      members: await this.members(
        boardId,
        balances.members.map((m) => m.userId),
      ),
      pending: rows
        .filter((row) => row.state === 'PENDING')
        .map(toEntryDto)
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
      sentBack: rows
        .filter(
          (row) =>
            row.state === 'REJECTED' &&
            (can(actor.role, 'finance.manage') ||
              row.createdById === actor.userId),
        )
        .map(toEntryDto)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
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
   * Members log their own money: they can't book it against someone else's
   * pocket. Admins can.
   */
  private assertMemberMayShape(
    actor: FinanceActor,
    dto: { handledById?: string | null },
  ) {
    if (can(actor.role, 'finance.manage')) return;
    if (dto.handledById && dto.handledById !== actor.userId) {
      throw new ForbiddenException(
        'You can only log money that went through your own pocket',
      );
    }
  }

  /**
   * Your own entries, or anyone's if you can manage the books. Once an admin
   * has approved your out-of-pocket expense it's locked to you.
   */
  private assertMayEdit(
    actor: FinanceActor,
    entry: { createdById: string | null; approvedAt: Date | null },
  ) {
    if (can(actor.role, 'finance.manage')) return;
    if (
      !can(actor.role, 'finance.create') ||
      entry.createdById !== actor.userId
    ) {
      throw new ForbiddenException('You can only change entries you logged');
    }
    if (
      isLockedFor(
        { approvedAt: entry.approvedAt?.toISOString() ?? null },
        false,
      )
    ) {
      throw new ForbiddenException(
        'An admin approved this, so only an admin can change it now',
      );
    }
  }

  /**
   * The state an edited entry ends up in. A member's own out-of-pocket expense
   * stays (or becomes) PENDING until an admin approves it; editing never
   * approves anything, that has its own route. A sent-back entry goes back to
   * PENDING the same way. Anything else takes the state asked for, and a
   * pending entry that no longer needs approval (an admin moved it to the
   * band's account) counts as settled.
   */
  private nextState(
    actor: FinanceActor,
    before: { state: FinanceState; createdById: string | null; approvedAt: Date | null },
    after: { kind: FinanceKind; handledById: string | null },
    dto: UpdateFinanceEntryDto,
  ): FinanceState {
    const fronted =
      !before.approvedAt &&
      before.createdById !== null &&
      needsApproval(after, before.createdById, false);
    const awaiting = before.state === 'PENDING' || before.state === 'REJECTED';
    // A member saving a sent-back entry is resubmitting it.
    if (fronted && (awaiting || !can(actor.role, 'finance.manage'))) {
      return 'PENDING';
    }
    if (dto.state) return dto.state;
    return awaiting ? 'SETTLED' : before.state;
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
   * Puts a member's expense in front of every admin: an inbox row each, and —
   * when `fresh` — a push and email. Rows are rewritten rather than updated so
   * they always restate the entry as it stands.
   */
  private async askForApproval(
    tx: Prisma.TransactionClient,
    entry: EntryRow,
    actorId: string,
    fresh: boolean,
  ) {
    const [admins, actor, board] = await Promise.all([
      tx.membership.findMany({
        where: { boardId: entry.boardId, role: 'ADMIN' },
        select: { userId: true },
      }),
      tx.user.findUnique({
        where: { id: actorId },
        select: { displayName: true },
      }),
      tx.board.findUnique({
        where: { id: entry.boardId },
        select: { currency: true },
      }),
    ]);
    const recipients = admins
      .map((m) => m.userId)
      .filter((id) => id !== actorId);
    await this.dropApprovalRows(tx, entry.id);
    if (recipients.length === 0) return;

    const actorName = actor?.displayName ?? 'A bandmate';
    const label = entry.description || categoryLabel(entry.category);
    const amount = formatMoney(entry.amountCents, board?.currency ?? 'USD');
    await tx.mentionNotification.createMany({
      data: recipients.map((userId) => ({
        boardId: entry.boardId,
        userId,
        kind: 'APPROVAL' as const,
        entryId: entry.id,
        actorName,
        taskTitle: `${label} · ${amount}`,
        excerpt: entry.note,
      })),
    });
    if (!fresh) return;

    // Keyed on the resubmission, not the entry: sending it back and getting
    // it again is two requests, and the admin should hear about both.
    const stamp = entry.updatedAt.getTime();
    await this.notifications.queue(
      tx,
      recipients.map((userId) => ({
        boardId: entry.boardId,
        userId,
        category: 'APPROVALS' as const,
        template: 'expense-approval',
        dedupeKey: `approval:${entry.id}:${stamp}:${userId}`,
        payload: {
          entryId: entry.id,
          actorName,
          label,
          amount,
          note: entry.note,
          eventTitle: entry.event?.title ?? '',
        },
      })),
    );
  }

  /**
   * Tells the member who logged the expense what the admin decided. The
   * admins' own request rows go, since there is nothing left to decide.
   */
  private async decide(
    tx: Prisma.TransactionClient,
    entry: EntryRow,
    actorId: string,
    decision: 'APPROVED' | 'REJECTED',
    note: string,
  ) {
    await this.dropApprovalRows(tx, entry.id);
    const recipient = entry.createdById;
    if (!recipient || recipient === actorId) return;

    const [actor, board] = await Promise.all([
      tx.user.findUnique({
        where: { id: actorId },
        select: { displayName: true },
      }),
      tx.board.findUnique({
        where: { id: entry.boardId },
        select: { currency: true },
      }),
    ]);
    const actorName = actor?.displayName ?? 'An admin';
    const label = entry.description || categoryLabel(entry.category);
    const amount = formatMoney(entry.amountCents, board?.currency ?? 'USD');
    await tx.mentionNotification.create({
      data: {
        boardId: entry.boardId,
        userId: recipient,
        kind: 'DECISION',
        entryId: entry.id,
        actorName,
        // The headline is written here so every client shows the same one.
        taskTitle: `${decision === 'APPROVED' ? 'Approved' : 'Sent back'}: ${label} · ${amount}`,
        excerpt: decision === 'APPROVED' ? 'The band owes you for it now.' : note,
      },
    });
    await this.notifications.queue(tx, {
      boardId: entry.boardId,
      userId: recipient,
      category: 'APPROVALS',
      template: 'expense-decided',
      dedupeKey: `decision:${entry.id}:${entry.updatedAt.getTime()}`,
      payload: { entryId: entry.id, actorName, label, amount, decision, note },
    });
  }

  private async dropApprovalRows(tx: Prisma.TransactionClient, entryId: string) {
    await tx.mentionNotification.deleteMany({
      where: { entryId, kind: 'APPROVAL' },
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
        label: entry.description || categoryLabel(entry.category),
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
    approvedById: row.approvedById,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    decisionNote: row.decisionNote,
    receiptCount: row._count.receipts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPayoutDto(row: {
  id: string;
  userId: string;
  amountCents: number;
  paidOn: Date;
  note: string;
  createdById: string | null;
  createdAt: Date;
}): PayoutDto {
  return {
    id: row.id,
    userId: row.userId,
    amountCents: row.amountCents,
    paidOn: fromDate(row.paidOn),
    note: row.note,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
  };
}
