import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useFinanceEntries, useFinanceSummary, usePermissions } from '@artist/api-client';
import {
  activeFinanceFilterCount,
  DEFAULT_FINANCE_FILTERS,
  filterFinanceEntries,
  formatMoney,
} from '@artist/shared';
import { PosterText } from '@/components/poster-text';
import { SpokeList } from '@/components/spoke-list';
import { FinanceEntryRow } from '@/features/finances/entry-row';
import { FinanceFilters } from '@/features/finances/entry-filters';
import { FinanceSearch } from '@/features/finances/finance-search';
import { shareFinanceCsv } from '@/features/finances/export-csv';
import { groupByMonth } from '@/features/finances/wallet-helpers';
import { ChipButton, Panel } from '@/features/finances/wallet-ui';
import { spacing, useTokens } from '@/theme';

/**
 * Every income and expense entry the band has logged, all time, as a bank
 * statement: a search box, Filters and Export as pills under it, and the
 * transactions in a white panel per month. Tapping one opens its form.
 */
export function FinanceEntriesScreen({ boardId }: { boardId: string }) {
  const tokens = useTokens();
  const { can } = usePermissions();
  const visible = can('finance.view');
  const summary = useFinanceSummary(boardId, {}, visible);
  const entries = useFinanceEntries(boardId);
  const [filters, setFilters] = useState(DEFAULT_FINANCE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const currency = summary.data?.currency ?? 'USD';
  const members = summary.data?.members ?? [];
  const name = (userId: string) =>
    members.find((m) => m.id === userId)?.displayName ?? 'Former member';
  const all = entries.data ?? [];
  const rows = filterFinanceEntries(all, filters);
  const groups = groupByMonth(rows, filters.sort);
  const active = activeFinanceFilterCount(filters);
  const narrowed = active > 0 || filters.query.trim() !== '';
  const net = rows.reduce(
    (sum, e) =>
      sum + (e.state === 'SETTLED' ? (e.kind === 'INCOME' ? e.amountCents : -e.amountCents) : 0),
    0,
  );

  return (
    <SpokeList
      pending={visible && (summary.isPending || entries.isPending)}
      error={summary.error ?? entries.error}
      onRetry={() => {
        void summary.refetch();
        void entries.refetch();
      }}
      empty={!visible || rows.length === 0}
      emptyIcon={{ sf: 'dollarsign.circle', md: 'account-balance-wallet' }}
      emptyTitle={
        !visible ? 'Only admins see the books' : narrowed ? 'No matches' : 'Nothing logged yet'
      }
      emptyBody={
        visible && narrowed
          ? 'Nothing matches this search and these filters.'
          : visible
            ? 'Log income or an expense from Finances.'
            : undefined
      }
      header={
        visible && all.length > 0 ? (
          <View style={{ gap: spacing.sm + 2, paddingBottom: spacing.xs }}>
            <FinanceSearch
              value={filters.query}
              onChange={(query) => setFilters({ ...filters, query })}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <ChipButton
                label="Filters"
                icon={{ sf: 'slider.horizontal.3', md: 'tune' }}
                active={filtersOpen}
                count={active}
                onPress={() => setFiltersOpen(!filtersOpen)}
              />
              {rows.length > 0 && (
                <ChipButton
                  label="Export CSV"
                  icon={{ sf: 'square.and.arrow.up', md: 'ios-share' }}
                  onPress={() =>
                    void shareFinanceCsv(rows, members, narrowed ? 'filtered' : 'all-time')
                  }
                />
              )}
            </View>
            {filtersOpen && (
              <Panel padded>
                <FinanceFilters filters={filters} onChange={setFilters} members={members} />
              </Panel>
            )}
            <PosterText
              variant="cardMeta"
              color={tokens.mutedForeground}
              style={{ paddingHorizontal: spacing.xs }}
            >
              {`${rows.length} of ${all.length} ${all.length === 1 ? 'entry' : 'entries'}${
                narrowed ? ` · net ${formatMoney(net, currency)}` : ''
              }`}
            </PosterText>
          </View>
        ) : undefined
      }
    >
      <View style={{ gap: spacing.md }}>
        {groups.map((group) => (
          <View key={group.key} style={{ gap: spacing.sm }}>
            {group.title && (
              <PosterText
                variant="label"
                color={tokens.mutedForeground}
                accessibilityRole="header"
                style={{ paddingHorizontal: spacing.xs }}
              >
                {group.title.toUpperCase()}
              </PosterText>
            )}
            <Panel>
              {group.entries.map((entry, index) => (
                <FinanceEntryRow
                  key={entry.id}
                  entry={entry}
                  currency={currency}
                  first={index === 0}
                  name={name}
                  onPress={() => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
                />
              ))}
            </Panel>
          </View>
        ))}
      </View>
    </SpokeList>
  );
}
