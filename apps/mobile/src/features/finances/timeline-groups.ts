import {
  ledgerTotals,
  type FinanceEntryDto,
  type FinanceSort,
  type LedgerTotals,
} from '@artist/shared';

/** One day on the timeline: its date, what was logged on it and its totals. */
export interface TimelineDay {
  /** `YYYY-MM-DD` */
  day: string;
  entries: FinanceEntryDto[];
  /** The shared ledger math over this day's entries, for its day header. */
  totals: LedgerTotals;
}

/**
 * One stretch of the timeline under a header: a calendar month, or, when the
 * list is sorted by amount, the whole list (dates then jump around, so a month
 * header would only repeat).
 */
export interface TimelineGroup {
  /** `YYYY-MM`, or null for a list sorted by amount. */
  month: string | null;
  days: TimelineDay[];
  /** The shared ledger math over this group's entries, for its header. */
  totals: LedgerTotals;
  count: number;
}

/**
 * Splits an already sorted ledger list into months, and each month into days,
 * keeping the order it came in. Totals come from `ledgerTotals`, the same math
 * the summary uses, so a month's header agrees with the reports.
 */
export function timelineGroups(
  entries: readonly FinanceEntryDto[],
  sort: FinanceSort = 'newest',
): TimelineGroup[] {
  if (entries.length === 0) return [];
  if (sort === 'highest' || sort === 'lowest') {
    return [
      {
        month: null,
        days: entries.map((entry) => ({
          day: entry.occurredOn,
          entries: [entry],
          totals: ledgerTotals([entry]),
        })),
        totals: ledgerTotals([...entries]),
        count: entries.length,
      },
    ];
  }

  const groups: { month: string; entries: FinanceEntryDto[] }[] = [];
  for (const entry of entries) {
    const month = entry.occurredOn.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.entries.push(entry);
    else groups.push({ month, entries: [entry] });
  }

  return groups.map(({ month, entries: inMonth }) => {
    const byDay: { day: string; entries: FinanceEntryDto[] }[] = [];
    for (const entry of inMonth) {
      const last = byDay[byDay.length - 1];
      if (last && last.day === entry.occurredOn) last.entries.push(entry);
      else byDay.push({ day: entry.occurredOn, entries: [entry] });
    }
    const days = byDay.map((d) => ({ ...d, totals: ledgerTotals(d.entries) }));
    return { month, days, totals: ledgerTotals(inMonth), count: inMonth.length };
  });
}

/** Entries on or after a `YYYY-MM-DD` day; null keeps them all. */
export function entriesSince(entries: readonly FinanceEntryDto[], from: string | null) {
  return from === null ? [...entries] : entries.filter((entry) => entry.occurredOn >= from);
}

/** `2026-10` → "October 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** `2026-11-05` → { day: "5", weekday: "Thu" }, on the local calendar. */
export function dayParts(day: string): { day: string; weekday: string; month: string } {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    day: String(d),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
  };
}

/** `2026-11-05` → "Thu 5 Nov", the day header's date. */
export function dayLabel(day: string): string {
  const parts = dayParts(day);
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}
