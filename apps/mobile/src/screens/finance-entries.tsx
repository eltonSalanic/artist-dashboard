import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useFinanceEntries, useFinanceSummary, useMe } from '@artist/api-client';
import {
  activeFinanceFilterCount,
  DEFAULT_FINANCE_FILTERS,
  filterFinanceEntries,
  formatMoney,
  ledgerTotals,
} from '@artist/shared';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { SpokeList } from '@/components/spoke-list';
import { FilterSheet } from '@/features/finances/filter-sheet';
import { FinanceSearch } from '@/features/finances/finance-search';
import { shareFinanceCsv } from '@/features/finances/export-csv';
import { QuickFilters } from '@/features/finances/quick-filters';
import { FinanceTimeline } from '@/features/finances/timeline';
import { timelineGroups } from '@/features/finances/timeline-groups';
import { spacing, useTokens } from '@/theme';

/**
 * Every income and expense entry the band has logged, all time, as one
 * timeline, month by month with each month's total. The search and the quick
 * filters stay pinned at the top; every other filter and the sort are in the
 * filter sheet. Tapping an entry opens its form.
 */
export function FinanceEntriesScreen({ boardId }: { boardId: string }) {
  const tokens = useTokens();
  const me = useMe(true);
  const summary = useFinanceSummary(boardId);
  const entries = useFinanceEntries(boardId);
  const [filters, setFilters] = useState(DEFAULT_FINANCE_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const currency = summary.data?.currency ?? 'USD';
  const members = summary.data?.members ?? [];
  const name = (userId: string) =>
    members.find((m) => m.id === userId)?.displayName ?? 'Former member';
  const all = entries.data ?? [];
  const rows = filterFinanceEntries(all, filters);
  const groups = timelineGroups(rows, filters.sort);
  const narrowed = activeFinanceFilterCount(filters) > 0 || filters.query.trim() !== '';
  const net = ledgerTotals(rows).netCents;

  return (
    <>
      <SpokeList
        pending={summary.isPending || entries.isPending}
        error={summary.error ?? entries.error}
        onRetry={() => {
          void summary.refetch();
          void entries.refetch();
        }}
        empty={rows.length === 0}
        emptyIcon={{ sf: 'dollarsign.circle', md: 'account-balance-wallet' }}
        emptyTitle={
          narrowed ? 'No matches' : 'Nothing logged yet'
        }
        emptyBody={
          narrowed
            ? 'Nothing matches this search and these filters.'
            : 'Log what the band earns and spends from Finances. If you pay out of your own pocket, the band owes you until an admin pays you back.'
        }
        pinned={
          all.length > 0 ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
              <FinanceSearch
                value={filters.query}
                onChange={(query) => setFilters({ ...filters, query })}
              />
              <QuickFilters
                filters={filters}
                onChange={setFilters}
                onOpenSheet={() => setSheetOpen(true)}
                members={members}
                me={me.data?.user.id}
              />
            </View>
          ) : null
        }
      >
        <View style={{ gap: spacing.lg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
              paddingLeft: spacing.xs,
            }}
          >
            <PosterText
              variant="cardMeta"
              color={tokens.mutedForeground}
              style={{ flex: 1 }}
              numberOfLines={2}
            >
              {`${rows.length} of ${all.length} ${all.length === 1 ? 'entry' : 'entries'}${
                narrowed ? ` · net ${formatMoney(net, currency)}` : ''
              }`}
            </PosterText>
            <Button
              title="Export CSV"
              variant="secondary"
              size="sm"
              onPress={() =>
                void shareFinanceCsv(rows, members, narrowed ? 'filtered' : 'all-time')
              }
            />
          </View>
          <FinanceTimeline
            groups={groups}
            currency={currency}
            sort={filters.sort}
            name={name}
            onOpen={(entry) => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
          />
        </View>
      </SpokeList>
      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        resultCount={rows.length}
        members={members}
      />
    </>
  );
}
