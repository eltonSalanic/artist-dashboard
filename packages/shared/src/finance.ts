import type { FinanceKind, FinanceState } from './enums';

/**
 * Band money, as numbers both platforms agree on.
 *
 * Everything here is pure so the web ledger, the phone's quick-add and the API
 * report the same cents. Amounts are integer cents in the board's currency and
 * never floats; shares are basis points (10000 = 100%) so a three-way split
 * rounds the same way everywhere.
 *
 * Balances are always computed from the entries, never stored, so there is no
 * running total to drift out of step with the ledger.
 */

export const BPS_WHOLE = 10_000;

/**
 * The categories a band files money under. A fixed list for now: it covers
 * what bands actually spend on, and keeps reports comparable across boards.
 * The key is what's stored; the label is what people read.
 */
export const FINANCE_CATEGORIES = [
  { key: 'SHOW_FEE', kind: 'INCOME', label: 'Show fee' },
  { key: 'MERCH_SALES', kind: 'INCOME', label: 'Merch' },
  { key: 'STREAMING', kind: 'INCOME', label: 'Streaming and royalties' },
  { key: 'SYNC', kind: 'INCOME', label: 'Sync and licensing' },
  { key: 'OTHER_INCOME', kind: 'INCOME', label: 'Other income' },
  { key: 'GEAR', kind: 'EXPENSE', label: 'Gear' },
  { key: 'TRAVEL', kind: 'EXPENSE', label: 'Travel and fuel' },
  { key: 'LODGING', kind: 'EXPENSE', label: 'Lodging' },
  { key: 'RECORDING', kind: 'EXPENSE', label: 'Recording' },
  { key: 'MARKETING', kind: 'EXPENSE', label: 'Marketing' },
  { key: 'REHEARSAL_SPACE', kind: 'EXPENSE', label: 'Rehearsal space' },
  { key: 'MERCH_STOCK', kind: 'EXPENSE', label: 'Merch stock' },
  { key: 'FEES', kind: 'EXPENSE', label: 'Fees and commissions' },
  { key: 'OTHER_EXPENSE', kind: 'EXPENSE', label: 'Other expense' },
] as const satisfies readonly {
  key: string;
  kind: FinanceKind;
  label: string;
}[];

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number]['key'];

export const FinanceCategoryKeys = FINANCE_CATEGORIES.map((c) => c.key) as [
  FinanceCategory,
  ...FinanceCategory[],
];

export function categoriesFor(kind: FinanceKind) {
  return FINANCE_CATEGORIES.filter((c) => c.kind === kind);
}

export function categoryLabel(key: string): string {
  return FINANCE_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export function categoryKind(key: string): FinanceKind | null {
  return FINANCE_CATEGORIES.find((c) => c.key === key)?.kind ?? null;
}

/** ISO 4217 codes offered in board settings. */
export const BOARD_CURRENCIES = [
  'USD',
  'CAD',
  'EUR',
  'GBP',
  'AUD',
  'NZD',
  'MXN',
  'SEK',
  'NOK',
  'DKK',
  'CHF',
  'JPY',
] as const;
export type BoardCurrency = (typeof BOARD_CURRENCIES)[number];

/** `-1234` in USD → `-$12.34`. Falls back to a plain number for an odd code. */
export function formatMoney(cents: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      cents / 100,
    );
  } catch {
    return (cents / 100).toFixed(2);
  }
}

/**
 * What someone typed into an amount field, as cents. Accepts `12`, `12.5`,
 * `$1,234.56`; rejects anything with more than two decimals or no digits.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[\s,$€£¥]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** One slice of a split. `userId` null is the band fund. */
export interface SplitShare {
  userId: string | null;
  shareBps: number;
}

/**
 * Equal shares for these members, with `fundBps` kept for the band first.
 * Basis points that don't divide evenly go to the first members listed, so
 * the shares always total exactly 10000.
 */
export function equalSplit(memberIds: string[], fundBps = 0): SplitShare[] {
  const fund = Math.max(0, Math.min(BPS_WHOLE, Math.round(fundBps)));
  const shares: SplitShare[] = fund > 0 ? [{ userId: null, shareBps: fund }] : [];
  if (memberIds.length === 0) {
    return [{ userId: null, shareBps: BPS_WHOLE }];
  }
  const rest = BPS_WHOLE - fund;
  const each = Math.floor(rest / memberIds.length);
  let leftover = rest - each * memberIds.length;
  for (const userId of memberIds) {
    const extra = leftover > 0 ? 1 : 0;
    leftover -= extra;
    shares.push({ userId, shareBps: each + extra });
  }
  return shares.filter((s) => s.shareBps > 0 || s.userId !== null);
}

export function sharesTotal(shares: SplitShare[]): number {
  return shares.reduce((sum, s) => sum + s.shareBps, 0);
}

/** A valid split: whole, no negative slices, nobody listed twice. */
export function isValidSplit(shares: SplitShare[]): boolean {
  if (shares.length === 0) return false;
  if (shares.some((s) => !Number.isInteger(s.shareBps) || s.shareBps < 0)) {
    return false;
  }
  const ids = shares.map((s) => s.userId ?? '__fund');
  if (new Set(ids).size !== ids.length) return false;
  return sharesTotal(shares) === BPS_WHOLE;
}

/**
 * Cut an amount by a split. Each slice rounds toward zero and the cents left
 * over go to the band fund, so slices always add back up to the amount and no
 * member gets an extra cent for being listed first.
 */
export function allocate(
  amountCents: number,
  shares: SplitShare[],
): { userId: string | null; cents: number }[] {
  const out = shares.map((s) => ({
    userId: s.userId,
    cents: Math.trunc((amountCents * s.shareBps) / BPS_WHOLE),
  }));
  const remainder = amountCents - out.reduce((sum, s) => sum + s.cents, 0);
  if (remainder !== 0) {
    const fund = out.find((s) => s.userId === null);
    if (fund) fund.cents += remainder;
    else out.push({ userId: null, cents: remainder });
  }
  return out;
}

/** The fields of an entry the money math needs. */
export interface LedgerEntry {
  kind: FinanceKind;
  state: FinanceState;
  amountCents: number;
  category: string;
  occurredOn: string;
  /**
   * The member whose own money this went through: who paid an expense out of
   * pocket, or who pocketed income (cash from the door) on the band's behalf.
   * Null means the band's own account.
   */
  handledById: string | null;
  splits: SplitShare[];
}

export interface LedgerPayout {
  userId: string;
  /** Positive: the band paid the member. Negative: the member paid the band. */
  amountCents: number;
}

export interface MemberBalance {
  userId: string;
  /** Their cut of settled income minus their cut of settled expenses. */
  shareCents: number;
  /** Expenses they paid personally. The band owes them this back. */
  frontedCents: number;
  /** Income they collected personally. They owe the band this. */
  collectedCents: number;
  /** What the band has already paid them, net. */
  paidOutCents: number;
  /** Positive: the band owes them. Negative: they owe the band. */
  balanceCents: number;
}

export interface Balances {
  members: MemberBalance[];
  /** The band fund's cut of everything settled. */
  bandFundCents: number;
}

const signed = (e: Pick<LedgerEntry, 'kind' | 'amountCents'>) =>
  e.kind === 'INCOME' ? e.amountCents : -e.amountCents;

/** Who is owed what, from settled entries and payouts. */
export function computeBalances(
  entries: LedgerEntry[],
  payouts: LedgerPayout[] = [],
): Balances {
  const byMember = new Map<string, MemberBalance>();
  const member = (userId: string) => {
    let row = byMember.get(userId);
    if (!row) {
      row = {
        userId,
        shareCents: 0,
        frontedCents: 0,
        collectedCents: 0,
        paidOutCents: 0,
        balanceCents: 0,
      };
      byMember.set(userId, row);
    }
    return row;
  };
  let bandFundCents = 0;

  for (const entry of entries) {
    if (entry.state !== 'SETTLED') continue;
    for (const slice of allocate(signed(entry), entry.splits)) {
      if (slice.userId === null) bandFundCents += slice.cents;
      else member(slice.userId).shareCents += slice.cents;
    }
    if (entry.handledById) {
      const row = member(entry.handledById);
      if (entry.kind === 'EXPENSE') row.frontedCents += entry.amountCents;
      else row.collectedCents += entry.amountCents;
    }
  }
  for (const payout of payouts) {
    member(payout.userId).paidOutCents += payout.amountCents;
  }
  for (const row of byMember.values()) {
    row.balanceCents =
      row.shareCents + row.frontedCents - row.collectedCents - row.paidOutCents;
  }
  return { members: [...byMember.values()], bandFundCents };
}

export interface CategoryTotal {
  category: string;
  kind: FinanceKind;
  cents: number;
}

export interface MonthTotal {
  /** `YYYY-MM` */
  month: string;
  incomeCents: number;
  expenseCents: number;
}

export interface LedgerTotals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  /** Income promised but not received yet. */
  expectedCents: number;
  byCategory: CategoryTotal[];
  byMonth: MonthTotal[];
}

/** Profit and loss for whatever entries are passed in (filter by date first). */
export function ledgerTotals(entries: LedgerEntry[]): LedgerTotals {
  let incomeCents = 0;
  let expenseCents = 0;
  let expectedCents = 0;
  const byCategory = new Map<string, CategoryTotal>();
  const byMonth = new Map<string, MonthTotal>();

  for (const entry of entries) {
    if (entry.state === 'VOID') continue;
    if (entry.state === 'EXPECTED') {
      if (entry.kind === 'INCOME') expectedCents += entry.amountCents;
      continue;
    }
    if (entry.kind === 'INCOME') incomeCents += entry.amountCents;
    else expenseCents += entry.amountCents;

    const cat = byCategory.get(entry.category) ?? {
      category: entry.category,
      kind: entry.kind,
      cents: 0,
    };
    cat.cents += entry.amountCents;
    byCategory.set(entry.category, cat);

    const key = entry.occurredOn.slice(0, 7);
    const month = byMonth.get(key) ?? { month: key, incomeCents: 0, expenseCents: 0 };
    if (entry.kind === 'INCOME') month.incomeCents += entry.amountCents;
    else month.expenseCents += entry.amountCents;
    byMonth.set(key, month);
  }

  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    expectedCents,
    byCategory: [...byCategory.values()].sort((a, b) => b.cents - a.cents),
    byMonth: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/** A show's money: what came in, what it cost, and each person's cut of the net. */
export function showSettlement(entries: LedgerEntry[]) {
  const settled = entries.filter((e) => e.state === 'SETTLED');
  const totals = ledgerTotals(settled);
  const { members, bandFundCents } = computeBalances(settled);
  return {
    incomeCents: totals.incomeCents,
    expenseCents: totals.expenseCents,
    netCents: totals.netCents,
    expectedCents: ledgerTotals(entries).expectedCents,
    cuts: members.map((m) => ({ userId: m.userId, cents: m.shareCents })),
    bandFundCents,
  };
}

export interface CsvEntry extends LedgerEntry {
  description: string;
  counterparty: string | null;
  eventTitle: string | null;
}

const csvCell = (text: string) => {
  // Leading = + - @ make a spreadsheet run the cell as a formula. A plain
  // number (a negative amount) is left alone.
  const safe =
    /^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The ledger as a spreadsheet for the accountant. Amounts in major units. */
export function financeCsv(
  entries: CsvEntry[],
  memberName: (userId: string) => string,
): string {
  const header = [
    'Date',
    'Type',
    'Status',
    'Category',
    'Amount',
    'Description',
    'Counterparty',
    'Show',
    'Handled by',
  ];
  const rows = [...entries]
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
    .map((e) => [
      e.occurredOn,
      e.kind === 'INCOME' ? 'Income' : 'Expense',
      e.state === 'SETTLED' ? 'Settled' : e.state === 'EXPECTED' ? 'Expected' : 'Void',
      categoryLabel(e.category),
      (signed(e) / 100).toFixed(2),
      e.description,
      e.counterparty ?? '',
      e.eventTitle ?? '',
      e.handledById ? memberName(e.handledById) : '',
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
