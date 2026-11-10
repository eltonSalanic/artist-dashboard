import type { FinanceEntryDto } from '@artist/shared';
import { dayLabel, dayParts, entriesSince, timelineGroups } from './timeline-groups';

let n = 0;
const entry = (
  occurredOn: string,
  amountCents: number,
  patch: Partial<FinanceEntryDto> = {},
): FinanceEntryDto => ({
  id: `e${++n}`,
  boardId: 'b',
  kind: 'EXPENSE',
  state: 'SETTLED',
  category: 'GEAR',
  amountCents,
  occurredOn,
  counterparty: null,
  description: '',
  note: '',
  eventId: null,
  eventTitle: null,
  handledById: null,
  createdById: null,
  paidBackAt: null,
  paidBackById: null,
  receiptCount: 0,
  createdAt: `${occurredOn}T12:00:00.000Z`,
  updatedAt: `${occurredOn}T12:00:00.000Z`,
  ...patch,
});

const ledger = [
  entry('2026-11-05', 3299),
  entry('2026-11-02', 5000),
  entry('2026-11-02', 60000, { kind: 'INCOME', category: 'SHOW_FEE' }),
  entry('2026-10-29', 11240, { kind: 'INCOME', category: 'STREAMING' }),
  entry('2026-10-24', 6400),
];

it('groups a newest-first list by month, then by day, in order', () => {
  const groups = timelineGroups(ledger);
  expect(groups.map((g) => g.month)).toEqual(['2026-11', '2026-10']);
  expect(groups[0].days.map((d) => [d.day, d.entries.length])).toEqual([
    ['2026-11-05', 1],
    ['2026-11-02', 2],
  ]);
  expect(groups[0].count).toBe(3);
});

it('totals each month with the shared ledger math', () => {
  const [nov, oct] = timelineGroups(ledger);
  expect(nov.totals).toMatchObject({ incomeCents: 60000, expenseCents: 8299, netCents: 51701 });
  expect(oct.totals.netCents).toBe(11240 - 6400);
});

it('leaves expected income out of the net but counts it as expected', () => {
  const [group] = timelineGroups([
    entry('2026-11-19', 120000, { kind: 'INCOME', state: 'EXPECTED', category: 'SHOW_FEE' }),
    entry('2026-11-05', 3299),
  ]);
  expect(group.totals.netCents).toBe(-3299);
  expect(group.totals.expectedCents).toBe(120000);
});

it('keeps an amount-sorted list as one group with every row dated', () => {
  const sorted = [...ledger].sort((a, b) => b.amountCents - a.amountCents);
  const groups = timelineGroups(sorted, 'highest');
  expect(groups).toHaveLength(1);
  expect(groups[0].month).toBeNull();
  expect(groups[0].days.map((d) => d.entries[0].amountCents)).toEqual([
    60000, 11240, 6400, 5000, 3299,
  ]);
});

it('returns nothing for an empty list', () => {
  expect(timelineGroups([])).toEqual([]);
});

it('keeps entries on or after a day, or all of them without one', () => {
  expect(entriesSince(ledger, '2026-11-01')).toHaveLength(3);
  expect(entriesSince(ledger, null)).toHaveLength(5);
});

it('reads a day on the local calendar', () => {
  expect(dayParts('2026-11-05').day).toBe('5');
  expect(dayParts('2026-11-01').day).toBe('1');
});

it('totals each day for its header, expected money apart from the net', () => {
  const [nov] = timelineGroups([
    entry('2026-11-19', 120000, { kind: 'INCOME', state: 'EXPECTED', category: 'SHOW_FEE' }),
    entry('2026-11-02', 60000, { kind: 'INCOME', category: 'SHOW_FEE' }),
    entry('2026-11-02', 5000),
  ]);
  expect(nov.days.map((d) => [d.day, d.totals.netCents, d.totals.expectedCents])).toEqual([
    ['2026-11-19', 0, 120000],
    ['2026-11-02', 55000, 0],
  ]);
});

it('labels a day header with weekday, day and month', () => {
  const label = dayLabel('2026-11-05');
  expect(label).toContain('5');
  expect(label).toMatch(/Thu/);
  expect(label).toMatch(/Nov/);
});
