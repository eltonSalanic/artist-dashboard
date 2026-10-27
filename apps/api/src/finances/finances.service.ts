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
  equalSplit,
  formatMoney,
  ledgerTotals,
  showSettlement,
  type Action,
  type BoardRole,
  type CreateFinanceEntryDto,
  type CreatePayoutDto,
  type FinanceEntryDto,
  type FinanceEntryQueryDto,
  type FinanceMemberRef,
  type FinanceSplitDto,
  type FinanceSummaryDto,
  type FinanceSummaryQueryDto,
  type LedgerEntry,
  type PayoutDto,
  type SettleShowDto,
  type ShowSettlementDto,
  type SplitShare,
  type UpdateFinanceEntryDto,
  type UpdateFinanceSettingsDto,
  type UpdateSplitDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

const entryInclude = {
  splits: { select: { userId: true, shareBps: true } },
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
    const splits = dto.splits ?? (await this.boardSplit(boardId)).shares;
    if (dto.splits) await this.assertSplitMembers(boardId, dto.splits);

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
          handledById: dto.handledById ?? null,
          createdById: actor.userId,
          splits: { create: splits },
        },
        include: entryInclude,
      });
      await this.logEntry(tx, boardId, actor.userId, created);
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
    if (dto.handledById) await this.assertMembers(boardId, [dto.handledById]);
    if (dto.splits) await this.assertSplitMembers(boardId, dto.splits);

    const entry = await this.prisma.$transaction(async (tx) => {
      if (dto.splits) {
        await tx.financeSplit.deleteMany({ where: { entryId } });
      }
      return tx.financeEntry.update({
        where: { id: entryId },
        data: {
          kind,
          category,
          state,
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
          ...(dto.splits ? { splits: { create: dto.splits } } : {}),
        },
        include: entryInclude,
      });
    });
    return toEntryDto(entry);
  }

  /** The books keep the row; it just stops counting. */
  async void(boardId: string, actor: FinanceActor, entryId: string) {
    const before = await this.getEntry(boardId, entryId);
    this.assertMayEdit(actor, before);
    const entry = await this.prisma.financeEntry.update({
      where: { id: entryId },
      data: { state: 'VOID' },
      include: entryInclude,
    });
    return toEntryDto(entry);
  }

  // ---- Split and settings ----

  async getSplit(
    boardId: string,
    actor: FinanceActor,
  ): Promise<FinanceSplitDto> {
    this.require(actor, 'finance.view');
    return this.boardSplit(boardId);
  }

  /** Applies to entries written from now on; past entries keep their split. */
  async setSplit(boardId: string, actor: FinanceActor, dto: UpdateSplitDto) {
    this.require(actor, 'finance.manage');
    await this.assertSplitMembers(boardId, dto.shares);
    await this.prisma.$transaction([
      this.prisma.splitShare.deleteMany({ where: { boardId } }),
      this.prisma.splitShare.createMany({
        data: dto.shares.map((s) => ({ boardId, ...s })),
      }),
    ]);
    return this.boardSplit(boardId);
  }

  async setSettings(
    boardId: string,
    actor: FinanceActor,
    dto: UpdateFinanceSettingsDto,
  ) {
    this.require(actor, 'finance.manage');
    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: { currency: dto.currency },
      select: { currency: true },
    });
    return board;
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

    const unpaid = new Map<string, number>();
    for (const row of rows) {
      if (row.state !== 'EXPECTED' || row.kind !== 'INCOME' || !row.eventId)
        continue;
      unpaid.set(row.eventId, (unpaid.get(row.eventId) ?? 0) + row.amountCents);
    }
    const shows = unpaid.size
      ? await this.prisma.event.findMany({
          where: { boardId, id: { in: [...unpaid.keys()] } },
          select: { id: true, title: true, startsAt: true },
          orderBy: { startsAt: 'asc' },
        })
      : [];

    return {
      currency,
      totals: ledgerTotals(inRange),
      balances,
      members: await this.members(
        boardId,
        balances.members.map((m) => m.userId),
      ),
      unpaidShows: shows.map((show) => ({
        eventId: show.id,
        title: show.title,
        startsAt: show.startsAt.toISOString(),
        expectedCents: unpaid.get(show.id) ?? 0,
      })),
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
    const [rows, split, currency] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where: { boardId, eventId, state: { not: 'VOID' } },
        include: entryInclude,
        orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
      }),
      this.boardSplit(boardId),
      this.currency(boardId),
    ]);
    const result = showSettlement(rows.map(toLedger));
    return {
      currency,
      event: { ...event, startsAt: event.startsAt.toISOString() },
      entries: rows.map(toEntryDto),
      ...result,
      split: split.shares,
      members: await this.members(
        boardId,
        result.cuts.map((c) => c.userId),
      ),
    };
  }

  /** Writes the night's lines and marks arrived fees received, all at once. */
  async settleShow(
    boardId: string,
    actor: FinanceActor,
    eventId: string,
    dto: SettleShowDto,
  ) {
    this.require(actor, 'finance.manage');
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
      select: { id: true, title: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    const handlers = dto.lines
      .map((l) => l.handledById)
      .filter((id): id is string => !!id);
    if (handlers.length) await this.assertMembers(boardId, handlers);
    if (dto.receivedIds.length) {
      const expected = await this.prisma.financeEntry.count({
        where: {
          id: { in: dto.receivedIds },
          boardId,
          eventId,
          state: 'EXPECTED',
        },
      });
      if (expected !== new Set(dto.receivedIds).size) {
        throw new BadRequestException(
          'Only this show’s expected fees can be marked received',
        );
      }
    }
    const { shares } = await this.boardSplit(boardId);

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        await tx.financeEntry.create({
          data: {
            boardId,
            kind: line.kind,
            state: 'SETTLED',
            category: line.category,
            amountCents: line.amountCents,
            occurredOn: toDate(dto.occurredOn),
            description: line.description ?? '',
            eventId,
            handledById: line.handledById ?? null,
            createdById: actor.userId,
            splits: { create: shares },
          },
        });
      }
      if (dto.receivedIds.length) {
        await tx.financeEntry.updateMany({
          where: { id: { in: dto.receivedIds }, boardId },
          data: { state: 'SETTLED' },
        });
      }
      await this.activity.log(tx, {
        boardId,
        type: 'SHOW_SETTLED',
        actorId: actor.userId,
        meta: { eventId, eventTitle: event.title },
      });
    });
    return this.showSettlement(boardId, actor, eventId);
  }

  // ---- Helpers ----

  private require(actor: FinanceActor, action: Action) {
    if (!can(actor.role, action)) {
      throw new ForbiddenException('Only board admins can do that');
    }
  }

  /**
   * Members log their own money: they can't book it against someone else's
   * pocket or carve up the split for one entry. Admins can.
   */
  private assertMemberMayShape(
    actor: FinanceActor,
    dto: { handledById?: string | null; splits?: SplitShare[] },
  ) {
    if (can(actor.role, 'finance.manage')) return;
    if (dto.handledById && dto.handledById !== actor.userId) {
      throw new ForbiddenException(
        'You can only log money that went through your own pocket',
      );
    }
    if (dto.splits) {
      throw new ForbiddenException('Only board admins can change a split');
    }
  }

  /** Your own entries, or anyone's if you can manage the books. */
  private assertMayEdit(
    actor: FinanceActor,
    entry: { createdById: string | null },
  ) {
    if (can(actor.role, 'finance.manage')) return;
    if (
      !can(actor.role, 'finance.create') ||
      entry.createdById !== actor.userId
    ) {
      throw new ForbiddenException('You can only change entries you logged');
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

  /** The saved split, or equal shares among today's members. */
  private async boardSplit(boardId: string): Promise<FinanceSplitDto> {
    const saved = await this.prisma.splitShare.findMany({
      where: { boardId },
      select: { userId: true, shareBps: true },
      orderBy: { shareBps: 'desc' },
    });
    if (saved.length) return { shares: saved, isDefault: false };
    const memberships = await this.prisma.membership.findMany({
      where: { boardId },
      select: { userId: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      shares: equalSplit(memberships.map((m) => m.userId)),
      isDefault: true,
    };
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

  private async assertSplitMembers(boardId: string, shares: SplitShare[]) {
    const ids = shares
      .map((s) => s.userId)
      .filter((id): id is string => id !== null);
    if (ids.length) await this.assertMembers(boardId, ids);
  }

  private async assertEventInBoard(boardId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');
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
    splits: row.splits,
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
    splits: row.splits,
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
