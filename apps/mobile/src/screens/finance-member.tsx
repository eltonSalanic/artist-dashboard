import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router, Stack } from 'expo-router';
import {
  useFinanceEntries,
  useFinanceSummary,
  useMe,
  usePayBackMember,
  usePermissions,
} from '@artist/api-client';
import {
  activeFinanceFilterCount,
  DEFAULT_FINANCE_FILTERS,
  filterFinanceEntries,
  formatMoney,
} from '@artist/shared';
import { Button } from '@/components/button';
import { PosterText } from '@/components/poster-text';
import { SectionCard } from '@/components/section-card';
import { SpokeList } from '@/components/spoke-list';
import { FinanceAmount } from '@/features/finances/finance-amount';
import { FinanceEntryRow } from '@/features/finances/entry-row';
import { FinanceFilters } from '@/features/finances/entry-filters';
import { FinanceSearch } from '@/features/finances/finance-search';
import { spacing, useTokens } from '@/theme';

/**
 * One member's money with the band: every expense they paid for out of their
 * own pocket, how much of that the band has paid back, and what it still owes
 * them. Admins can pay back everything at once, or one expense from its form.
 */
export function FinanceMemberScreen({ boardId, userId }: { boardId: string; userId: string }) {
  const tokens = useTokens();
  const { can } = usePermissions();
  const me = useMe(true);
  const visible = can('finance.view');
  const manages = can('finance.manage');
  const summary = useFinanceSummary(boardId, {}, visible);
  const entries = useFinanceEntries(boardId, { kind: 'EXPENSE' });
  const payBackAll = usePayBackMember(boardId);
  const [filters, setFilters] = useState(DEFAULT_FINANCE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const data = summary.data;
  const currency = data?.currency ?? 'USD';
  const money = (cents: number) => formatMoney(cents, currency);
  const member = data?.members.find((m) => m.id === userId);
  const memberName = member?.displayName ?? 'Former member';
  const you = userId === me.data?.user.id;
  const balance = data?.balances.members.find((b) => b.userId === userId) ?? {
    paidCents: 0,
    paidBackCents: 0,
    owedCents: 0,
  };
  const theirs = (entries.data ?? []).filter(
    (e) => e.handledById === userId && e.state === 'SETTLED',
  );
  const rows = filterFinanceEntries(theirs, filters);
  const active = activeFinanceFilterCount(filters);
  const narrowed = active > 0 || filters.query.trim() !== '';
  const owedCount = theirs.filter((e) => !e.paidBackAt).length;

  const confirmPayBackAll = () =>
    Alert.alert(
      `Pay ${memberName} back ${money(balance.owedCents)}?`,
      `That's ${owedCount} ${owedCount === 1 ? 'expense' : 'expenses'}, out of the band fund. Each one locks once it's paid back; you can undo any of them from the expense.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay back', onPress: () => payBackAll.mutate(userId) },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: you ? `${memberName} (you)` : memberName }} />
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
          !visible ? 'Only admins see the books' : narrowed ? 'No matches' : 'No expenses paid yet'
        }
        emptyBody={
          !visible
            ? undefined
            : narrowed
              ? 'None of their expenses match these filters.'
              : `When ${you ? 'you pay' : `${memberName} pays`} for something out of pocket, it shows up here.`
        }
        header={
          visible && data ? (
            <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
              <SectionCard
                title="Overview"
                caption="All time"
                description={
                  balance.owedCents > 0
                    ? `The band owes ${you ? 'you' : memberName} ${money(balance.owedCents)}.`
                    : balance.paidCents > 0
                      ? `Everything ${you ? 'you' : 'they'} paid for has been paid back.`
                      : undefined
                }
              >
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.lg,
                    paddingHorizontal: spacing.sm,
                    paddingBottom: spacing.sm,
                  }}
                >
                  <Stat label="PAID FOR THE BAND" cents={balance.paidCents} currency={currency} />
                  <Stat label="PAID BACK" cents={balance.paidBackCents} currency={currency} />
                  <Stat
                    label="STILL OWED"
                    cents={balance.owedCents}
                    currency={currency}
                    tone={balance.owedCents > 0 ? 'owed' : undefined}
                  />
                </View>
                {manages && balance.owedCents > 0 && (
                  <View
                    style={{
                      paddingHorizontal: spacing.sm,
                      paddingBottom: spacing.sm,
                    }}
                  >
                    <Button
                      title={`Pay back all ${money(balance.owedCents)}`}
                      disabled={payBackAll.isPending}
                      onPress={confirmPayBackAll}
                    />
                  </View>
                )}
              </SectionCard>

              {theirs.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                  <PosterText variant="label" color={tokens.mutedForeground}>
                    ALL EXPENSES
                  </PosterText>
                  <FinanceSearch
                    value={filters.query}
                    onChange={(query) => setFilters({ ...filters, query })}
                    placeholder="Search their expenses…"
                  />
                  <Button
                    title={`${filtersOpen ? 'Hide filters' : 'Filter by category or amount'}${active ? ` (${active})` : ''}`}
                    variant="secondary"
                    size="sm"
                    onPress={() => setFiltersOpen(!filtersOpen)}
                  />
                  {filtersOpen && (
                    <FinanceFilters
                      filters={{ ...filters, kind: 'EXPENSE' }}
                      onChange={setFilters}
                      kinds={false}
                    />
                  )}
                  <PosterText variant="cardMeta" color={tokens.mutedForeground}>
                    {`${rows.length} of ${theirs.length} ${theirs.length === 1 ? 'expense' : 'expenses'}`}
                  </PosterText>
                </View>
              )}
            </View>
          ) : undefined
        }
      >
        {rows.map((entry, index) => (
          <FinanceEntryRow
            key={entry.id}
            entry={entry}
            currency={currency}
            first={index === 0}
            name={() => memberName}
            showPayer={false}
            onPress={() => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
          />
        ))}
      </SpokeList>
    </>
  );
}

function Stat({
  label,
  cents,
  currency,
  tone,
}: {
  label: string;
  cents: number;
  currency: string;
  tone?: 'owed';
}) {
  const tokens = useTokens();
  return (
    <View style={{ flexGrow: 1, flexBasis: '28%', gap: 2 }}>
      <PosterText variant="label" color={tokens.mutedForeground}>
        {label}
      </PosterText>
      {tone === 'owed' ? (
        <FinanceAmount cents={cents} currency={currency} owed />
      ) : (
        <PosterText variant="rowTitle" color={tokens.foreground}>
          {formatMoney(cents, currency)}
        </PosterText>
      )}
    </View>
  );
}
