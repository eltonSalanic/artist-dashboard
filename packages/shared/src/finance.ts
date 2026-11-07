import type { FinanceKind, FinanceState } from './enums';

/**
 * Band money, as numbers both platforms agree on.
 *
 * Everything here is pure so the web ledger, the phone's quick-add and the API
 * report the same cents. Amounts are integer cents in the board's currency and
 * never floats.
 *
 * The books are a ledger: what came in and what went out. Profit is the
 * band's. A member is only owed money when they paid for an expense out of
 * their own pocket, and only until an admin pays them back from the band fund.
 *
 * Balances are always computed from the entries, never stored, so there is no
 * running total to drift out of step with the ledger.
 */

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

/**
 * Band Wall keeps every band's books in US dollars. `Board.currency` stays in
 * the schema (always 'USD') so a later multi-currency version has somewhere to
 * live, but nothing lets a band change it.
 */
export const BOARD_CURRENCY = 'USD';

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
 * Shown after a show is cancelled while money is still logged as expected for
 * it. Shared so web's toast and the phone's alert say the same thing.
 */
export function cancelledShowMoneyNotice(cents: number, currency = 'USD'): string {
  return `This show still has ${formatMoney(cents, currency)} expected. If you won't receive payment, remove it in the show's Money section.`;
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

/** The fields of an entry the money math needs. */
export interface LedgerEntry {
  kind: FinanceKind;
  state: FinanceState;
  amountCents: number;
  category: string;
  occurredOn: string;
  /**
   * Expenses only: the member who paid out of their own pocket. Null means the
   * band's own account. Always null for income.
   */
  handledById: string | null;
  /** When an admin paid the member back for it, as an ISO time. */
  paidBackAt: string | null;
}

type PaybackFields = Pick<LedgerEntry, 'kind' | 'handledById'>;

/** An expense a member paid with their own money, so the band owes it back. */
export function isOutOfPocket(entry: PaybackFields): boolean {
  return entry.kind === 'EXPENSE' && entry.handledById !== null;
}

/** Where an out-of-pocket expense stands. Null for anything else. */
export type PaybackStatus = 'owed' | 'paid';

export function paybackStatus(
  entry: PaybackFields & Pick<LedgerEntry, 'state' | 'paidBackAt'>,
): PaybackStatus | null {
  if (!isOutOfPocket(entry) || entry.state !== 'SETTLED') return null;
  return entry.paidBackAt ? 'paid' : 'owed';
}

/** The label both platforms show on an out-of-pocket expense. */
export const PAYBACK_LABELS: Record<PaybackStatus, string> = {
  owed: 'Owed back',
  paid: 'Paid back',
};

/**
 * Who may change or void an entry. Nobody once it's paid back: an admin has to
 * undo the payback first, so the amount a member was paid can't drift from the
 * entry. Otherwise admins can change anything; a member can change an expense
 * they paid for, or an entry they logged on the band account.
 */
export function canEditEntry(
  entry: {
    handledById: string | null;
    createdById: string | null;
    paidBackAt: string | null;
  },
  userId: string,
  canManage: boolean,
): boolean {
  if (entry.paidBackAt) return false;
  if (canManage) return true;
  if (entry.handledById) return entry.handledById === userId;
  return entry.createdById === userId;
}

export interface MemberBalance {
  userId: string;
  /** Everything they paid for the band out of their own pocket. */
  paidCents: number;
  /** How much of that an admin has paid back. */
  paidBackCents: number;
  /** What the band still owes them: paid, less paid back. */
  owedCents: number;
}

export interface Balances {
  members: MemberBalance[];
  /**
   * The band's own money: income received, less what the band account paid
   * for and what it paid members back. Can go below zero when the band pays a
   * member back before it has the money.
   */
  bandFundCents: number;
  /** What the band owes all members together. */
  owedCents: number;
}

const signed = (e: Pick<LedgerEntry, 'kind' | 'amountCents'>) =>
  e.kind === 'INCOME' ? e.amountCents : -e.amountCents;

/** The band fund and who is owed what, from settled entries. */
export function computeBalances(entries: LedgerEntry[]): Balances {
  const byMember = new Map<string, MemberBalance>();
  let bandFundCents = 0;
  let owedCents = 0;

  for (const entry of entries) {
    if (entry.state !== 'SETTLED') continue;
    if (!isOutOfPocket(entry)) {
      bandFundCents += signed(entry);
      continue;
    }
    const userId = entry.handledById!;
    let row = byMember.get(userId);
    if (!row) {
      row = { userId, paidCents: 0, paidBackCents: 0, owedCents: 0 };
      byMember.set(userId, row);
    }
    row.paidCents += entry.amountCents;
    if (entry.paidBackAt) {
      row.paidBackCents += entry.amountCents;
      bandFundCents -= entry.amountCents;
    } else {
      row.owedCents += entry.amountCents;
      owedCents += entry.amountCents;
    }
  }
  return { members: [...byMember.values()], bandFundCents, owedCents };
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

/** A show's money: what came in, what it cost, and what's still expected. */
export function showSettlement(entries: LedgerEntry[]) {
  const settled = entries.filter((e) => e.state === 'SETTLED');
  const totals = ledgerTotals(settled);
  return {
    incomeCents: totals.incomeCents,
    expenseCents: totals.expenseCents,
    netCents: totals.netCents,
    expectedCents: ledgerTotals(entries).expectedCents,
  };
}

export interface CsvEntry extends LedgerEntry {
  description: string;
  counterparty: string | null;
  eventTitle: string | null;
}

const STATE_LABELS: Record<FinanceState, string> = {
  SETTLED: 'Settled',
  EXPECTED: 'Expected',
  VOID: 'Void',
};

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
    'Paid by',
    'Paid back',
  ];
  const rows = [...entries]
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
    .map((e) => [
      e.occurredOn,
      e.kind === 'INCOME' ? 'Income' : 'Expense',
      STATE_LABELS[e.state],
      categoryLabel(e.category),
      (signed(e) / 100).toFixed(2),
      e.description,
      e.counterparty ?? '',
      e.eventTitle ?? '',
      e.kind === 'EXPENSE'
        ? e.handledById
          ? memberName(e.handledById)
          : 'Band account'
        : '',
      isOutOfPocket(e) ? (e.paidBackAt?.slice(0, 10) ?? 'Owed') : '',
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

/** A date on the local calendar, as the `YYYY-MM-DD` the API takes. */
export function localDayISO(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The first of this month through today, for "this month" totals. */
export function monthToDate(now = new Date()): { from: string; to: string } {
  const today = localDayISO(now);
  return { from: `${today.slice(0, 7)}-01`, to: today };
}
