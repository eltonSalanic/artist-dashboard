import { FINANCE_CATEGORIES, type FinanceEntryDto } from '@artist/shared';
import { barShare, categoryIcon, groupByMonth, initials } from './wallet-helpers';

const entry = (id: string, occurredOn: string, amountCents = 100): FinanceEntryDto => ({
  id,
  boardId: 'b',
  kind: 'EXPENSE',
  state: 'SETTLED',
  category: 'GEAR',
  amountCents,
  occurredOn,
  counterparty: null,
  description: id,
  note: '',
  eventId: null,
  eventTitle: null,
  handledById: null,
  createdById: null,
  paidBackAt: null,
  paidBackById: null,
  receiptCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

describe('categoryIcon', () => {
  it('has an icon of its own for every category', () => {
    const fallbacks = [categoryIcon('NOPE', 'INCOME'), categoryIcon('NOPE', 'EXPENSE')];
    for (const c of FINANCE_CATEGORIES) {
      const icon = categoryIcon(c.key, c.kind);
      expect(icon.md).toBeTruthy();
      if (c.key !== 'OTHER_INCOME' && c.key !== 'OTHER_EXPENSE') {
        expect(fallbacks).not.toContainEqual(icon);
      }
    }
  });

  it('falls back to an arrow in or out', () => {
    expect(categoryIcon('NEW_THING', 'INCOME').md).toBe('south-west');
    expect(categoryIcon('NEW_THING', 'EXPENSE').md).toBe('north-east');
  });
});

describe('initials', () => {
  it('takes the first and last word', () => {
    expect(initials('Jamie Torres')).toBe('JT');
    expect(initials('Mary Ann de Vries')).toBe('MV');
    expect(initials(' riley ')).toBe('R');
    expect(initials('')).toBe('?');
  });
});

describe('groupByMonth', () => {
  const list = [
    entry('a', '2026-11-05'),
    entry('b', '2026-11-02'),
    entry('c', '2026-10-30'),
    entry('d', '2026-09-01'),
  ];

  it('heads a date-sorted list by month, keeping its order', () => {
    const groups = groupByMonth(list, 'newest');
    expect(groups.map((g) => g.key)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a', 'b']);
    expect(groups[0].title).toMatch(/2026/);
  });

  it('keeps an amount-sorted list as one group', () => {
    const groups = groupByMonth(list, 'highest');
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBeNull();
    expect(groups[0].entries).toHaveLength(4);
  });

  it('has no groups for no entries', () => {
    expect(groupByMonth([], 'newest')).toEqual([]);
    expect(groupByMonth([], 'lowest')).toEqual([]);
  });
});

describe('barShare', () => {
  it('is a share of the largest, with a visible minimum', () => {
    expect(barShare(50, 100)).toBe(0.5);
    expect(barShare(1, 1000)).toBe(0.04);
    expect(barShare(0, 100)).toBe(0);
    expect(barShare(100, 0)).toBe(0);
  });
});
