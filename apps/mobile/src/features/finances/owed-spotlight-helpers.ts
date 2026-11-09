import type { FinanceEntryDto, FinanceSummaryDto } from '@artist/shared';

/**
 * Where a member stands with the band: waiting to be paid back, paid back for
 * everything they paid for, or never paid for anything out of pocket.
 */
export type OwedStanding = 'owed' | 'paidBack' | 'nothing';

/** One face on the Owed tab's grid of faces, and what the spotlight shows for them. */
export interface OwedPerson {
  id: string;
  name: string;
  you: boolean;
  /** What they paid for the band out of their own pocket, all time. */
  paidCents: number;
  paidBackCents: number;
  /** What the band still owes them. */
  owedCents: number;
  /** Their expenses not paid back yet, in the order the summary lists them. */
  owedEntries: FinanceEntryDto[];
  standing: OwedStanding;
}

/**
 * Everyone the Owed tab shows, most owed first, then those who have been paid
 * back, then those who haven't paid for anything, by name within each. Today's
 * members are all here; someone who left still shows while the band owes them,
 * so no unpaid expense goes missing. Reads the summary's balances, never adds
 * money up itself.
 */
export function owedPeople(
  data: Pick<FinanceSummaryDto, 'members' | 'balances' | 'owed'>,
  myId: string | undefined,
): OwedPerson[] {
  const names = new Map(data.members.map((m) => [m.id, m.displayName]));
  const ids = new Set(data.members.map((m) => m.id));
  for (const b of data.balances.members) if (b.owedCents > 0) ids.add(b.userId);

  return [...ids]
    .map((id): OwedPerson => {
      const b = data.balances.members.find((row) => row.userId === id);
      const owedCents = b?.owedCents ?? 0;
      const paidCents = b?.paidCents ?? 0;
      return {
        id,
        name: names.get(id) ?? 'Former member',
        you: id === myId,
        paidCents,
        paidBackCents: b?.paidBackCents ?? 0,
        owedCents,
        owedEntries: data.owed.filter((e) => e.handledById === id),
        standing: owedCents > 0 ? 'owed' : paidCents > 0 ? 'paidBack' : 'nothing',
      };
    })
    .sort(
      (a, b) =>
        b.owedCents - a.owedCents || b.paidCents - a.paidCents || a.name.localeCompare(b.name),
    );
}

/** "Jamie Torres" → "Jamie": the name under a face in the grid. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** "2 expenses", "1 expense". */
export function expenseCount(n: number): string {
  return `${n} ${n === 1 ? 'expense' : 'expenses'}`;
}

/** "Casey", "Casey and Riley", "Casey, Riley and Sam": the square line. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
