import type { FinanceEntryDto } from './dto/finance.dto';
import { categoryLabel, paybackStatus } from './finance';

export const FINANCE_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Amount: high to low' },
  { value: 'lowest', label: 'Amount: low to high' },
] as const;
export type FinanceSort = (typeof FINANCE_SORTS)[number]['value'];

/** Who paid, as a filter value: a member's id, or `'band'` for the band account. */
export const BAND_ACCOUNT = 'band';

export interface FinanceViewFilters {
  /** `'all'`, `'INCOME'` or `'EXPENSE'`. */
  kind: string;
  /** Who paid. Empty means anyone; `'band'` is the band account. */
  members: string[];
  category: string;
  state: string;
  /** Out-of-pocket expenses only: still owed, or already paid back. */
  payback: 'all' | 'owed' | 'paid';
  /** Matches what it was for, the note, who was paid and the category. */
  query: string;
  /** Inclusive, in cents. Null means no limit. */
  minCents: number | null;
  maxCents: number | null;
  sort: FinanceSort;
}

export const DEFAULT_FINANCE_FILTERS: FinanceViewFilters = {
  kind: 'all',
  members: [],
  category: 'all',
  state: 'all',
  payback: 'all',
  query: '',
  minCents: null,
  maxCents: null,
  sort: 'newest',
};

/** How many filters differ from the defaults (search and sort aside), for a badge. */
export function activeFinanceFilterCount(filters: FinanceViewFilters): number {
  return [
    filters.kind !== 'all',
    filters.members.length > 0,
    filters.category !== 'all',
    filters.state !== 'all',
    filters.payback !== 'all',
    filters.minCents !== null || filters.maxCents !== null,
  ].filter(Boolean).length;
}

function matchesQuery(entry: FinanceEntryDto, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [
    entry.description,
    entry.note,
    entry.counterparty ?? '',
    entry.eventTitle ?? '',
    categoryLabel(entry.category),
  ]
    .join(' ')
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

/** Filter a copy, preserving the query cache and using absolute transaction amounts for sorting. */
export function filterFinanceEntries(
  entries: readonly FinanceEntryDto[],
  filters: FinanceViewFilters,
) {
  return entries
    .filter(
      (e) =>
        (filters.kind === 'all' || e.kind === filters.kind) &&
        (filters.members.length === 0 ||
          filters.members.includes(e.handledById ?? BAND_ACCOUNT)) &&
        (filters.category === 'all' || e.category === filters.category) &&
        (filters.state === 'all' || e.state === filters.state) &&
        (filters.payback === 'all' || paybackStatus(e) === filters.payback) &&
        (filters.minCents === null || e.amountCents >= filters.minCents) &&
        (filters.maxCents === null || e.amountCents <= filters.maxCents) &&
        matchesQuery(e, filters.query),
    )
    .sort((a, b) => {
      const newest =
        b.occurredOn.localeCompare(a.occurredOn) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id);
      if (filters.sort === 'oldest') return -newest;
      if (filters.sort === 'highest') return b.amountCents - a.amountCents || newest;
      if (filters.sort === 'lowest') return a.amountCents - b.amountCents || newest;
      return newest;
    });
}

/** Shared readable finance colors on light and dark page surfaces. */
export const FINANCE_COLORS = {
  light: { positive: '#047857', negative: '#b91c1c' },
  dark: { positive: '#34d399', negative: '#f87171' },
} as const;
