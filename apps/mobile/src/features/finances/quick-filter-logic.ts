import {
  DEFAULT_FINANCE_FILTERS,
  FINANCE_CATEGORIES,
  type FinanceViewFilters,
} from '@artist/shared';

/**
 * What a tap on a quick filter chip does to the shared ledger filters. The
 * chips and the full filter sheet edit the same `FinanceViewFilters`, so a
 * chip is only a shortcut to a setting the sheet also shows.
 */

/** Everything off, but the search and the sort stay as they are. */
export function clearFilters(filters: FinanceViewFilters): FinanceViewFilters {
  return { ...DEFAULT_FINANCE_FILTERS, query: filters.query, sort: filters.sort };
}

/**
 * Expenses or income, or back to both when it's already on. A category from
 * the other side would match nothing, so it goes; so does "owed back", which
 * only an expense can be.
 */
export function setKind(filters: FinanceViewFilters, kind: string): FinanceViewFilters {
  const keepsCategory = FINANCE_CATEGORIES.some(
    (c) => c.key === filters.category && (kind === 'all' || c.kind === kind),
  );
  return {
    ...filters,
    kind,
    category: keepsCategory ? filters.category : 'all',
    payback: kind === 'INCOME' ? 'all' : filters.payback,
  };
}

export const toggleKind = (filters: FinanceViewFilters, kind: 'EXPENSE' | 'INCOME') =>
  setKind(filters, filters.kind === kind ? 'all' : kind);

/** Owed back or paid back; income can't be either, so it stops hiding them. */
export function togglePayback(
  filters: FinanceViewFilters,
  payback: 'owed' | 'paid',
): FinanceViewFilters {
  return {
    ...filters,
    payback: filters.payback === payback ? 'all' : payback,
    kind: filters.kind === 'INCOME' ? 'all' : filters.kind,
  };
}

/** Adds or removes one payer (a member's id, or the band account). */
export function toggleMember(filters: FinanceViewFilters, id: string): FinanceViewFilters {
  return {
    ...filters,
    members: filters.members.includes(id)
      ? filters.members.filter((m) => m !== id)
      : [...filters.members, id],
  };
}

export function toggleCategory(filters: FinanceViewFilters, category: string): FinanceViewFilters {
  return { ...filters, category: filters.category === category ? 'all' : category };
}
