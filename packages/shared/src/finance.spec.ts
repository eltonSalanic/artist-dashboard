import {
  allocate,
  computeBalances,
  equalSplit,
  financeCsv,
  isValidSplit,
  ledgerTotals,
  parseMoneyToCents,
  showSettlement,
  type LedgerEntry,
} from './finance';
import { createFinanceEntrySchema, settleShowSchema } from './dto/finance.dto';

const entry = (over: Partial<LedgerEntry>): LedgerEntry => ({
  kind: 'INCOME',
  state: 'SETTLED',
  amountCents: 0,
  category: 'SHOW_FEE',
  occurredOn: '2026-10-01',
  handledById: null,
  splits: equalSplit(['a', 'b']),
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

describe('equalSplit', () => {
  it('always totals 100%', () => {
    for (const n of [1, 2, 3, 4, 6, 7]) {
      const ids = Array.from({ length: n }, (_, i) => `m${i}`);
      expect(isValidSplit(equalSplit(ids))).toBe(true);
      expect(isValidSplit(equalSplit(ids, 2000))).toBe(true);
    }
  });

  it('keeps the band fund cut first', () => {
    expect(equalSplit(['a', 'b'], 2000)).toEqual([
      { userId: null, shareBps: 2000 },
      { userId: 'a', shareBps: 4000 },
      { userId: 'b', shareBps: 4000 },
    ]);
  });

  it('puts everything in the fund when nobody is listed', () => {
    expect(equalSplit([])).toEqual([{ userId: null, shareBps: 10_000 }]);
  });
});

describe('isValidSplit', () => {
  it('rejects duplicates, shortfalls and negatives', () => {
    expect(isValidSplit([])).toBe(false);
    expect(isValidSplit([{ userId: 'a', shareBps: 9000 }])).toBe(false);
    expect(
      isValidSplit([
        { userId: 'a', shareBps: 5000 },
        { userId: 'a', shareBps: 5000 },
      ]),
    ).toBe(false);
    expect(
      isValidSplit([
        { userId: 'a', shareBps: 11000 },
        { userId: 'b', shareBps: -1000 },
      ]),
    ).toBe(false);
  });
});

describe('allocate', () => {
  it('gives the leftover cent to the band fund, not the first member', () => {
    const shares = equalSplit(['a', 'b', 'c']);
    const slices = allocate(1000, shares);
    expect(slices).toEqual([
      { userId: 'a', cents: 333 },
      { userId: 'b', cents: 333 },
      { userId: 'c', cents: 333 },
      { userId: null, cents: 1 },
    ]);
  });

  it('adds back up to the amount, negative amounts included', () => {
    const shares = equalSplit(['a', 'b', 'c'], 1500);
    for (const amount of [1, 7, 999, 100_001, -4321]) {
      const total = allocate(amount, shares).reduce((s, x) => s + x.cents, 0);
      expect(total).toBe(amount);
    }
  });
});

describe('computeBalances', () => {
  it('splits a show and credits whoever fronted the gas', () => {
    const { members, bandFundCents } = computeBalances([
      entry({ amountCents: 40_000 }),
      entry({ kind: 'EXPENSE', category: 'TRAVEL', amountCents: 4_000, handledById: 'a' }),
    ]);
    const a = members.find((m) => m.userId === 'a')!;
    const b = members.find((m) => m.userId === 'b')!;
    expect(a.shareCents).toBe(18_000);
    expect(a.frontedCents).toBe(4_000);
    expect(a.balanceCents).toBe(22_000);
    expect(b.balanceCents).toBe(18_000);
    expect(bandFundCents).toBe(0);
  });

  it('charges a member for cash they collected, and nets payouts', () => {
    const { members } = computeBalances(
      [entry({ category: 'MERCH_SALES', amountCents: 10_000, handledById: 'b' })],
      [{ userId: 'a', amountCents: 5_000 }],
    );
    const a = members.find((m) => m.userId === 'a')!;
    const b = members.find((m) => m.userId === 'b')!;
    expect(a.balanceCents).toBe(0);
    expect(b.balanceCents).toBe(-5_000);
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
  it('reports each cut of the night’s net', () => {
    const result = showSettlement([
      entry({ amountCents: 50_000 }),
      entry({ kind: 'EXPENSE', category: 'FEES', amountCents: 10_000 }),
      entry({ amountCents: 7_000, state: 'EXPECTED' }),
    ]);
    expect(result.netCents).toBe(40_000);
    expect(result.expectedCents).toBe(7_000);
    expect(result.cuts).toEqual([
      { userId: 'a', cents: 20_000 },
      { userId: 'b', cents: 20_000 },
    ]);
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

  it('needs something to settle', () => {
    expect(settleShowSchema.safeParse({ occurredOn: '2026-10-01' }).success).toBe(false);
  });
});
