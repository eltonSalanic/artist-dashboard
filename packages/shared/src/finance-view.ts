import type { FinanceEntryDto } from './dto/finance.dto';

export const FINANCE_SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'highest', label: 'Amount: high to low' },
  { value: 'lowest', label: 'Amount: low to high' },
] as const;
export type FinanceSort = (typeof FINANCE_SORTS)[number]['value'];
export interface FinanceViewFilters {
  kind: string;
  member: string;
  category: string;
  state: string;
  sort: FinanceSort;
}
export const DEFAULT_FINANCE_FILTERS: FinanceViewFilters = {
  kind: 'all',
  member: 'all',
  category: 'all',
  state: 'all',
  sort: 'newest',
};

/** Filter a copy, preserving the query cache and using absolute transaction amounts for sorting. */
export function filterFinanceEntries(
  entries: readonly FinanceEntryDto[],
  filters: FinanceViewFilters,
) {
  return entries
    .filter(
      (e) =>
        (filters.kind === 'all' || e.kind === filters.kind) &&
        (filters.member === 'all' ||
          (filters.member === 'band'
            ? e.handledById === null
            : e.handledById === filters.member)) &&
        (filters.category === 'all' || e.category === filters.category) &&
        (filters.state === 'all' || e.state === filters.state),
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
