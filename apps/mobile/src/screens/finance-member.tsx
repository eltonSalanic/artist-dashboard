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
import { SpokeList } from '@/components/spoke-list';
import { FinanceEntryRow } from '@/features/finances/entry-row';
import { FinanceFilters } from '@/features/finances/entry-filters';
import { FinanceSearch } from '@/features/finances/finance-search';
import { groupByMonth } from '@/features/finances/wallet-helpers';
import { SpotlightFace, StatTiles } from '@/features/finances/owed-spotlight';
import { expenseCount } from '@/features/finances/owed-spotlight-helpers';
import { ChipButton, Panel, PanelTitle, Segmented } from '@/features/finances/wallet-ui';
import { spacing, useScheme, useTokens } from '@/theme';
import { MONEY_COLORS } from '@/theme/money-colors';

/** Which of a member's expenses the switch over the list shows. */
type Show = 'owed' | 'paid' | 'all';

/**
 * One member's money with the band, with them in the spotlight: their face,
 * what the band owes them (or a big "Square"), then what they paid for the
 * band, what's been paid back and what's still owed as three tiles. Admins can
 * pay back everything at once, or one expense from its form. Under that, every
 * expense they paid for out of their own pocket, month by month, with a switch
 * for owed back, paid back or all of them, a search and filters.
 */
export function FinanceMemberScreen({ boardId, userId }: { boardId: string; userId: string }) {
  const tokens = useTokens();
  const finance = MONEY_COLORS[useScheme()];
  const { can } = usePermissions();
  const me = useMe(true);
  const manages = can('finance.manage');
  const summary = useFinanceSummary(boardId);
  const entries = useFinanceEntries(boardId, { kind: 'EXPENSE' });
  const payBackAll = usePayBackMember(boardId);
  const [filters, setFilters] = useState(DEFAULT_FINANCE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Bumped by Reset so the amount boxes, which keep their own text, start empty.
  const [resets, setResets] = useState(0);
  const [shown, setShown] = useState<Show | null>(null);

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
  const owedCount = theirs.filter((e) => !e.paidBackAt).length;
  const owes = balance.owedCents > 0;
  // The switch over the list opens on what's still owed, when anything is.
  const show: Show = shown ?? (owedCount > 0 ? 'owed' : 'all');
  const rows = filterFinanceEntries(theirs, { ...filters, payback: show });
  const groups = groupByMonth(rows, filters.sort);
  const active = activeFinanceFilterCount(filters);
  const narrowed = active > 0 || filters.query.trim() !== '';
  const them = you ? 'you' : 'them';

  const confirmPayBackAll = () =>
    Alert.alert(
      `Pay ${memberName} back ${money(balance.owedCents)}?`,
      `That's ${owedCount} ${owedCount === 1 ? 'expense' : 'expenses'} ${memberName} will be paid back for. This records that the band paid them back. It doesn't send any money. You can undo this anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay back', onPress: () => payBackAll.mutate(userId) },
      ],
    );

  return (
    <>
      <Stack.Screen options={{ title: you ? `${memberName} (you)` : memberName }} />
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
          theirs.length === 0
              ? 'No expenses paid yet'
              : narrowed
                ? 'No matches'
                : show === 'owed'
                  ? 'Nothing owed back'
                  : 'Nothing paid back yet'
        }
        emptyBody={
          theirs.length === 0
              ? `When ${you ? 'you pay' : `${memberName} pays`} for something out of pocket, it shows up here.`
              : narrowed
                ? `None of ${you ? 'your' : 'their'} expenses match this search and these filters.`
                : show === 'owed'
                  ? `Everything ${you ? 'you' : 'they'} paid for has been paid back.`
                  : `Once an admin pays ${them} back, it shows up here.`
        }
        header={
          data ? (
            <View style={{ gap: spacing.lg, paddingBottom: spacing.xs }}>
              <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
                <SpotlightFace
                  name={memberName}
                  size={96}
                  standing={owes ? 'owed' : balance.paidCents > 0 ? 'paidBack' : 'nothing'}
                  cutout={tokens.background}
                  squareRing
                />
                <PosterText
                  variant="title"
                  color={tokens.foreground}
                  numberOfLines={1}
                  style={{ marginTop: spacing.xs }}
                >
                  {you ? `${memberName} (you)` : memberName}
                </PosterText>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  {owes ? (
                    <>
                      <PosterText variant="label" color={tokens.mutedForeground}>
                        {`THE BAND OWES ${you ? 'YOU' : 'THEM'}`}
                      </PosterText>
                      <PosterText
                        variant="figure"
                        color={finance.negative}
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {money(balance.owedCents)}
                      </PosterText>
                    </>
                  ) : (
                    <PosterText variant="figure" color={tokens.foreground}>
                      Square
                    </PosterText>
                  )}
                  <PosterText
                    variant="cardMeta"
                    color={tokens.mutedForeground}
                    style={{ textAlign: 'center', maxWidth: 270 }}
                  >
                    {owes
                      ? `For ${expenseCount(owedCount)} ${you ? 'you' : 'they'} paid for out of pocket, not paid back yet.`
                      : balance.paidCents > 0
                        ? `Everything ${you ? 'you' : 'they'} paid for has been paid back.`
                        : `${you ? 'You haven’t' : 'They haven’t'} paid for anything out of pocket.`}
                  </PosterText>
                </View>
              </View>

              <StatTiles
                paidCents={balance.paidCents}
                paidBackCents={balance.paidBackCents}
                owedCents={balance.owedCents}
                currency={currency}
                you={you}
              />

              {manages && owes && (
                <View style={{ gap: spacing.xs }}>
                  <Button
                    title={`Pay back all ${money(balance.owedCents)}`}
                    disabled={payBackAll.isPending}
                    onPress={confirmPayBackAll}
                  />
                  <PosterText
                    variant="cardMeta"
                    color={tokens.mutedForeground}
                    style={{ textAlign: 'center' }}
                  >
                    Records it against the band fund. No money is sent. You’ll confirm first.
                  </PosterText>
                </View>
              )}

              {theirs.length > 0 && (
                <View style={{ gap: spacing.sm + 2 }}>
                  <PanelTitle
                    title={you ? 'Your expenses' : 'Expenses'}
                    caption={`${rows.length} of ${theirs.length}`}
                  />
                  <Segmented<Show>
                    label="Which expenses"
                    size="sm"
                    value={show}
                    onChange={setShown}
                    options={[
                      { value: 'owed', label: `Owed back · ${owedCount}` },
                      { value: 'paid', label: `Paid back · ${theirs.length - owedCount}` },
                      { value: 'all', label: `All · ${theirs.length}` },
                    ]}
                  />
                  <FinanceSearch
                    value={filters.query}
                    onChange={(query) => setFilters({ ...filters, query })}
                    placeholder={you ? 'Search your expenses…' : 'Search their expenses…'}
                  />
                  <View style={{ flexDirection: 'row' }}>
                    <ChipButton
                      label="Filter by category or amount"
                      icon={{ sf: 'slider.horizontal.3', md: 'tune' }}
                      active={filtersOpen}
                      count={active}
                      onPress={() => setFiltersOpen(!filtersOpen)}
                    />
                  </View>
                  {filtersOpen && (
                    <Panel padded>
                      <FinanceFilters
                        key={resets}
                        filters={{ ...filters, kind: 'EXPENSE' }}
                        onChange={setFilters}
                        kinds={false}
                        payback={false}
                      />
                      {active > 0 && (
                        <Button
                          title="Reset filters"
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            setFilters({ ...DEFAULT_FINANCE_FILTERS, query: filters.query });
                            setResets((n) => n + 1);
                          }}
                        />
                      )}
                    </Panel>
                  )}
                </View>
              )}
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
                    name={() => memberName}
                    showPayer={false}
                    onPress={() => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
                  />
                ))}
              </Panel>
            </View>
          ))}
        </View>
      </SpokeList>
    </>
  );
}
