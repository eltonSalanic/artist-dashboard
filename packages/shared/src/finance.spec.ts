import {
  cancelledShowMoneyNotice,
  computeBalances,
  canEditEntry,
  financeCsv,
  ledgerTotals,
  parseMoneyToCents,
  paybackStatus,
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
  paidBackAt: null,
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
  const gas = (over: Partial<LedgerEntry> = {}) =>
    entry({
      kind: 'EXPENSE',
      category: 'TRAVEL',
      amountCents: 4_000,
      handledById: 'a',
      ...over,
    });

  it('keeps the profit with the band and owes whoever paid for the gas', () => {
    const { members, bandFundCents, owedCents } = computeBalances([
      entry({ amountCents: 40_000 }),
      gas(),
    ]);
    expect(members).toEqual([
      { userId: 'a', paidCents: 4_000, paidBackCents: 0, owedCents: 4_000 },
    ]);
    // Out of the member's pocket, not the band's, until it's paid back.
    expect(bandFundCents).toBe(40_000);
    expect(owedCents).toBe(4_000);
  });

  it('takes a payback out of the band fund, even below zero', () => {
    const { members, bandFundCents, owedCents } = computeBalances([
      gas({ paidBackAt: '2026-10-03T00:00:00.000Z' }),
      gas({ amountCents: 1_000 }),
    ]);
    expect(members[0]).toEqual({
      userId: 'a',
      paidCents: 5_000,
      paidBackCents: 4_000,
      owedCents: 1_000,
    });
    expect(bandFundCents).toBe(-4_000);
    expect(owedCents).toBe(1_000);
  });

  it('spends band-account expenses straight from the fund', () => {
    const { members, bandFundCents } = computeBalances([
      entry({ amountCents: 10_000 }),
      gas({ handledById: null }),
    ]);
    expect(members).toEqual([]);
    expect(bandFundCents).toBe(6_000);
  });

  it('ignores expected and void entries', () => {
    const { members, bandFundCents } = computeBalances([
      entry({ amountCents: 500, state: 'EXPECTED' }),
      entry({ amountCents: 500, state: 'VOID' }),
      gas({ state: 'VOID' }),
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
      `2026-10-01,Expense,Settled,Gear,-12.50,"'=HYPERLINK(""x"")","Strings, Inc.",,Alex,Owed`,
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

describe('paybacks', () => {
  it('labels only out-of-pocket expenses', () => {
    const gas = entry({ kind: 'EXPENSE', category: 'TRAVEL', handledById: 'a' });
    expect(paybackStatus(gas)).toBe('owed');
    expect(paybackStatus({ ...gas, paidBackAt: '2026-10-03T00:00:00.000Z' })).toBe('paid');
    expect(paybackStatus({ ...gas, handledById: null })).toBeNull();
    expect(paybackStatus({ ...gas, state: 'VOID' })).toBeNull();
    expect(paybackStatus(entry({}))).toBeNull();
  });

  it('lets admins and whoever paid edit, until it is paid back', () => {
    const mine = { handledById: 'a', createdById: 'b', paidBackAt: null };
    expect(canEditEntry(mine, 'a', false)).toBe(true);
    expect(canEditEntry(mine, 'b', false)).toBe(false);
    expect(canEditEntry(mine, 'c', true)).toBe(true);
    const band = { handledById: null, createdById: 'b', paidBackAt: null };
    expect(canEditEntry(band, 'b', false)).toBe(true);
    expect(canEditEntry(band, 'a', false)).toBe(false);
    const paid = { ...mine, paidBackAt: '2026-10-03T00:00:00.000Z' };
    expect(canEditEntry(paid, 'a', false)).toBe(false);
    expect(canEditEntry(paid, 'c', true)).toBe(false);
  });

  it('says who paid and whether it was paid back in the spreadsheet', () => {
    const row = (over: Partial<LedgerEntry>) => ({
      ...entry({ kind: 'EXPENSE', category: 'TRAVEL', amountCents: 5_000, ...over }),
      description: 'Tire',
      counterparty: null,
      eventTitle: null,
    });
    const csv = financeCsv(
      [
        row({ handledById: 'a', occurredOn: '2026-10-01' }),
        row({ handledById: 'a', occurredOn: '2026-10-02', paidBackAt: '2026-10-05T12:00:00.000Z' }),
        row({ occurredOn: '2026-10-03' }),
      ],
      () => 'Jamie',
    );
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('Paid by,Paid back');
    expect(lines[1].endsWith('Jamie,Owed')).toBe(true);
    expect(lines[2].endsWith('Jamie,2026-10-05')).toBe(true);
    expect(lines[3].endsWith('Band account,')).toBe(true);
  });
});

describe('cancelledShowMoneyNotice', () => {
  it('names the amount in the band currency', () => {
    expect(cancelledShowMoneyNotice(40000, 'USD')).toBe(
      "This show still has $400.00 expected. If you won't receive payment, remove it in the show's Money section.",
    );
  });
});
