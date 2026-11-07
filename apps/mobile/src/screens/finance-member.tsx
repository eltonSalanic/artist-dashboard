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
  FINANCE_COLORS,
  filterFinanceEntries,
  formatMoney,
} from '@artist/shared';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { SpokeList } from '@/components/spoke-list';
import { FinanceEntryRow } from '@/features/finances/entry-row';
import { FinanceFilters } from '@/features/finances/entry-filters';
import { FinanceSearch } from '@/features/finances/finance-search';
import { groupByMonth } from '@/features/finances/wallet-helpers';
import { Avatar, ChipButton, Panel, PanelTitle } from '@/features/finances/wallet-ui';
import { spacing, useScheme, useTokens } from '@/theme';

/**
 * One member's money with the band, set out like an account statement: what
 * they paid for the band, what's been paid back, and the balance the band
 * still owes them, then every expense they paid for out of their own pocket,
 * month by month. Admins can pay back everything at once, or one expense from
 * its form.
 */
export function FinanceMemberScreen({ boardId, userId }: { boardId: string; userId: string }) {
  const tokens = useTokens();
  const finance = FINANCE_COLORS[useScheme()];
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
  const groups = groupByMonth(rows, filters.sort);
  const active = activeFinanceFilterCount(filters);
  const narrowed = active > 0 || filters.query.trim() !== '';
  const owedCount = theirs.filter((e) => !e.paidBackAt).length;
  const owes = balance.owedCents > 0;

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
            <View style={{ gap: spacing.md, paddingBottom: spacing.xs }}>
              <Panel padded>
                <View style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 }}>
                    <Avatar name={memberName} size={48} owed={owes} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <PosterText variant="title" color={tokens.foreground} numberOfLines={1}>
                        {you ? `${memberName} (you)` : memberName}
                      </PosterText>
                      <PosterText variant="cardMeta" color={tokens.mutedForeground}>
                        Statement · all time
                      </PosterText>
                    </View>
                  </View>

                  <View style={{ gap: 2 }}>
                    <PosterText variant="label" color={tokens.mutedForeground}>
                      {owes ? `THE BAND OWES ${you ? 'YOU' : 'THEM'}` : 'BALANCE'}
                    </PosterText>
                    {owes ? (
                      <PosterText
                        variant="figure"
                        color={finance.negative}
                        style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1.6 }}
                      >
                        {money(balance.owedCents)}
                      </PosterText>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Icon
                          name={{ sf: 'checkmark.circle.fill', md: 'check-circle' }}
                          size={30}
                          color={finance.positive}
                        />
                        <PosterText
                          variant="figure"
                          color={tokens.foreground}
                          style={{ fontSize: 44, lineHeight: 50, letterSpacing: -1.6 }}
                        >
                          Square
                        </PosterText>
                      </View>
                    )}
                    <PosterText variant="cardMeta" color={tokens.mutedForeground}>
                      {owes
                        ? `${owedCount} ${owedCount === 1 ? 'expense' : 'expenses'} ${you ? 'you' : 'they'} paid for out of pocket, not paid back yet.`
                        : balance.paidCents > 0
                          ? `Everything ${you ? 'you' : 'they'} paid for has been paid back.`
                          : `${you ? 'You haven’t' : 'They haven’t'} paid for anything out of pocket.`}
                    </PosterText>
                  </View>

                  <View
                    style={{
                      gap: spacing.sm,
                      paddingTop: spacing.md,
                      borderTopWidth: 1,
                      borderTopColor: tokens.border,
                    }}
                  >
                    <StatementLine label="Paid for the band" value={money(balance.paidCents)} />
                    <StatementLine
                      label={you ? 'Paid back to you' : 'Paid back to them'}
                      value={
                        balance.paidBackCents > 0 ? `−${money(balance.paidBackCents)}` : money(0)
                      }
                    />
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderStyle: 'dashed',
                        borderTopColor: tokens.border,
                      }}
                    />
                    <StatementLine
                      label="Still owed"
                      value={money(balance.owedCents)}
                      color={owes ? finance.negative : undefined}
                      bold
                    />
                  </View>

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
                        Comes out of the band fund. You’ll confirm first.
                      </PosterText>
                    </View>
                  )}
                </View>
              </Panel>

              {theirs.length > 0 && (
                <View style={{ gap: spacing.sm + 2 }}>
                  <PanelTitle title="Expenses" caption={`${rows.length} of ${theirs.length}`} />
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
                        filters={{ ...filters, kind: 'EXPENSE' }}
                        onChange={setFilters}
                        kinds={false}
                      />
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

/** One line of the statement: a name on the left, its amount on the right. */
function StatementLine({
  label,
  value,
  color,
  bold = false,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  const tokens = useTokens();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
      <PosterText
        variant={bold ? 'caption' : 'body'}
        color={bold ? tokens.foreground : tokens.mutedForeground}
        style={{ flex: 1 }}
      >
        {label}
      </PosterText>
      <PosterText
        variant={bold ? 'caption' : 'body'}
        color={color ?? tokens.foreground}
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {value}
      </PosterText>
    </View>
  );
}
