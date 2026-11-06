import {
  cancelledShowMoneyNotice,
  computeBalances,
  financeCsv,
  isLockedFor,
  ledgerTotals,
  needsApproval,
  parseMoneyToCents,
  showSettlement,
  type LedgerEntry,
} from './finance';
import { createFinanceEntrySchema } from './dto/finance.dto';

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  kind: 'INCOME',
  state: 'SETTLED',
  amountCents: 0,
  category: 'SHOW_FEE',
  occurredOn: '2026-10-01',
  handledById: null,
  ...over,
});

describe('parseMoneyToCents', () => {
  it('reads what people type', () => {
    expect(parseMoneyToCents('12')).toBe(1200);
    expect(parseMoneyToCents('12.5')).toBe(1250);
    expect(parseMoneyToCents('$1,234.56')).toBe(123456);
    expect(parseMoneyToCents(' 0.07 ')).toBe(7);
  });

  it('refuses what is not an amount', () => {
    expect(parseMoneyToCents('')).toBeNull();
    expect(parseMoneyToCents('abc')).toBeNull();
    expect(parseMoneyToCents('1.234')).toBeNull();
    expect(parseMoneyToCents('-5')).toBeNull();
  });
});

describe('computeBalances', () => {
  it('keeps the profit with the band and credits whoever fronted the gas', () => {
    const { members, bandFundCents } = computeBalances([
      entry({ amountCents: 40_000 }),
      entry({ kind: 'EXPENSE', category: 'TRAVEL', amountCents: 4_000, handledById: 'a' }),
    ]);
    const a = members.find((m) => m.userId === 'a')!;
    expect(a.frontedCents).toBe(4_000);
    expect(a.balanceCents).toBe(4_000);
    expect(members.find((m) => m.userId === 'b')).toBeUndefined();
    expect(bandFundCents).toBe(36_000);
  });

  it('charges a member for cash they collected, and nets payouts', () => {
    const { members } = computeBalances(
      [entry({ category: 'MERCH_SALES', amountCents: 10_000, handledById: 'b' })],
      [{ userId: 'a', amountCents: 5_000 }],
    );
    const a = members.find((m) => m.userId === 'a')!;
    const b = members.find((m) => m.userId === 'b')!;
    expect(a.balanceCents).toBe(-5_000);
    expect(b.balanceCents).toBe(-10_000);
  });

  it('ignores expected and void entries', () => {
    const { members, bandFundCents } = computeBalances([
      entry({ amountCents: 500, state: 'EXPECTED' }),
      entry({ amountCents: 500, state: 'VOID' }),
    ]);
    expect(members).toEqual([]);
    expect(bandFundCents).toBe(0);
  });
});

describe('ledgerTotals', () => {
  it('rolls up by month and category, with expected income on the side', () => {
    const totals = ledgerTotals([
      entry({ amountCents: 30_000, occurredOn: '2026-09-12' }),
      entry({ amountCents: 20_000, occurredOn: '2026-10-03' }),
      entry({ kind: 'EXPENSE', category: 'GEAR', amountCents: 5_000, occurredOn: '2026-10-04' }),
      entry({ amountCents: 15_000, state: 'EXPECTED' }),
      entry({ amountCents: 99_999, state: 'VOID' }),
    ]);
    expect(totals.incomeCents).toBe(50_000);
    expect(totals.expenseCents).toBe(5_000);
    expect(totals.netCents).toBe(45_000);
    expect(totals.expectedCents).toBe(15_000);
    expect(totals.byMonth).toEqual([
      { month: '2026-09', incomeCents: 30_000, expenseCents: 0 },
      { month: '2026-10', incomeCents: 20_000, expenseCents: 5_000 },
    ]);
    expect(totals.byCategory[0]).toEqual({ category: 'SHOW_FEE', kind: 'INCOME', cents: 50_000 });
  });
});

describe('showSettlement', () => {
  it('reports the night’s net and what is still expected', () => {
    const result = showSettlement([
      entry({ amountCents: 50_000 }),
      entry({ kind: 'EXPENSE', category: 'FEES', amountCents: 10_000 }),
      entry({ amountCents: 7_000, state: 'EXPECTED' }),
    ]);
    expect(result.netCents).toBe(40_000);
    expect(result.expectedCents).toBe(7_000);
  });
});

describe('financeCsv', () => {
  it('signs amounts, quotes commas and defuses formulas', () => {
    const csv = financeCsv(
      [
        {
          ...entry({ kind: 'EXPENSE', category: 'GEAR', amountCents: 1_250, handledById: 'a' }),
          description: '=HYPERLINK("x")',
          counterparty: 'Strings, Inc.',
          eventTitle: null,
        },
      ],
      () => 'Alex',
    );
    const [, row] = csv.trim().split('\n');
    expect(row).toBe(
      `2026-10-01,Expense,Settled,Gear,-12.50,"'=HYPERLINK(""x"")","Strings, Inc.",,Alex`,
    );
  });
});

describe('finance DTOs', () => {
  it('refuses a category from the other side of the ledger', () => {
    const result = createFinanceEntrySchema.safeParse({
      kind: 'EXPENSE',
      category: 'SHOW_FEE',
      amountCents: 100,
      occurredOn: '2026-10-01',
    });
    expect(result.success).toBe(false);
  });

  it('only lets income be expected', () => {
    const result = createFinanceEntrySchema.safeParse({
      kind: 'EXPENSE',
      category: 'GEAR',
      amountCents: 100,
      occurredOn: '2026-10-01',
      state: 'EXPECTED',
    });
    expect(result.success).toBe(false);
  });
});

describe('approval', () => {
  it('holds only a member’s own out-of-pocket expense', () => {
    const fronted = { kind: 'EXPENSE' as const, handledById: 'a' };
    expect(needsApproval(fronted, 'a', false)).toBe(true);
    expect(needsApproval(fronted, 'a', true)).toBe(false);
    expect(needsApproval({ kind: 'INCOME', handledById: 'a' }, 'a', false)).toBe(false);
    expect(needsApproval({ kind: 'EXPENSE', handledById: null }, 'a', false)).toBe(false);
  });

  it('locks an approved entry to members only', () => {
    const approved = { approvedAt: '2026-10-03T00:00:00.000Z' };
    expect(isLockedFor(approved, false)).toBe(true);
    expect(isLockedFor(approved, true)).toBe(false);
    expect(isLockedFor({ approvedAt: null }, false)).toBe(false);
  });

  it('keeps pending expenses out of the totals and the balances', () => {
    const pending = entry({
      kind: 'EXPENSE',
      category: 'TRAVEL',
      state: 'PENDING',
      amountCents: 5_000,
      handledById: 'a',
    });
    const totals = ledgerTotals([pending]);
    expect(totals.expenseCents).toBe(0);
    expect(totals.pendingCents).toBe(5_000);
    expect(computeBalances([pending]).members).toEqual([]);
  });

  it('labels a pending entry in the spreadsheet', () => {
    const csv = financeCsv(
      [
        {
          ...entry({ kind: 'EXPENSE', category: 'TRAVEL', state: 'PENDING', amountCents: 5_000 }),
          description: 'Tire',
          counterparty: null,
          eventTitle: null,
        },
      ],
      () => '',
    );
    expect(csv).toContain('Pending approval');
  });
});

describe('cancelledShowMoneyNotice', () => {
  it('names the amount in the band currency', () => {
    expect(cancelledShowMoneyNotice(40000, 'USD')).toBe(
      "This show still has $400.00 expected. If you won't receive payment, remove it in the show's Money section.",
    );
  });
});
