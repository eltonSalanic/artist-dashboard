import type { FinanceEntryDto } from '@artist/shared';
import { expenseCount, firstName, joinNames, owedPeople } from './owed-spotlight-helpers';

const entry = (id: string, handledById: string, amountCents: number): FinanceEntryDto => ({
  id,
  boardId: 'b',
  kind: 'EXPENSE',
  state: 'SETTLED',
  category: 'GEAR',
  amountCents,
  occurredOn: '2026-11-01',
  counterparty: null,
  description: id,
  note: '',
  eventId: null,
  eventTitle: null,
  handledById,
  createdById: handledById,
  paidBackAt: null,
  paidBackById: null,
  receiptCount: 0,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
});

const data = {
  members: [
    { id: 'riley', displayName: 'Riley Park' },
    { id: 'casey', displayName: 'Casey Morgan' },
    { id: 'jamie', displayName: 'Jamie Torres' },
    { id: 'avery', displayName: 'Avery Brooks' },
  ],
  balances: {
    members: [
      { userId: 'casey', paidCents: 5000, paidBackCents: 5000, owedCents: 0 },
      { userId: 'jamie', paidCents: 8299, paidBackCents: 0, owedCents: 8299 },
      { userId: 'avery', paidCents: 6480, paidBackCents: 0, owedCents: 6480 },
      { userId: 'gone', paidCents: 1000, paidBackCents: 0, owedCents: 1000 },
    ],
    bandFundCents: 0,
    owedCents: 16779,
  },
  owed: [
    entry('tire', 'jamie', 5000),
    entry('amp', 'avery', 6480),
    entry('heads', 'jamie', 3299),
    entry('cable', 'gone', 1000),
  ],
};

describe('owedPeople', () => {
  const people = owedPeople(data, 'riley');

  it('puts the most owed first, then the paid back, then those who paid for nothing', () => {
    expect(people.map((p) => p.id)).toEqual(['jamie', 'avery', 'gone', 'casey', 'riley']);
    expect(people.map((p) => p.standing)).toEqual(['owed', 'owed', 'owed', 'paidBack', 'nothing']);
  });

  it('keeps someone who left while the band still owes them', () => {
    expect(people.find((p) => p.id === 'gone')?.name).toBe('Former member');
  });

  it('gives each person their own unpaid expenses, in the summary’s order', () => {
    expect(people[0].owedEntries.map((e) => e.id)).toEqual(['tire', 'heads']);
    expect(people.find((p) => p.id === 'casey')?.owedEntries).toEqual([]);
  });

  it('marks the viewer', () => {
    expect(people.filter((p) => p.you).map((p) => p.id)).toEqual(['riley']);
    expect(owedPeople(data, undefined).some((p) => p.you)).toBe(false);
  });

  it('takes the amounts from the balances as they are', () => {
    expect(people[0]).toMatchObject({ paidCents: 8299, paidBackCents: 0, owedCents: 8299 });
    expect(people.find((p) => p.id === 'riley')).toMatchObject({ paidCents: 0, owedCents: 0 });
  });
});

describe('wording', () => {
  it('shortens a name to the first word', () => {
    expect(firstName('Jamie Torres')).toBe('Jamie');
    expect(firstName('  riley ')).toBe('riley');
  });

  it('counts expenses', () => {
    expect(expenseCount(1)).toBe('1 expense');
    expect(expenseCount(4)).toBe('4 expenses');
  });

  it('joins names the way a sentence would', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Casey'])).toBe('Casey');
    expect(joinNames(['Casey', 'Riley'])).toBe('Casey and Riley');
    expect(joinNames(['Casey', 'Riley', 'Sam'])).toBe('Casey, Riley and Sam');
  });
});
