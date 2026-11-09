import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useFinanceEntries, useFinanceSummary, useMe, usePermissions } from '@artist/api-client';
import {
  activeFinanceFilterCount,
  categoryLabel,
  DEFAULT_FINANCE_FILTERS,
  FINANCE_COLORS,
  filterFinanceEntries,
  formatMoney,
  ledgerTotals,
  monthToDate,
  type FinanceEntryDto,
  type FinanceMemberRef,
  type FinanceSummaryDto,
} from '@artist/shared';
import { useMemo, useState } from 'react';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { SpokeList } from '@/components/spoke-list';
import { radius, spacing, useScheme, useShadows, useTokens } from '@/theme';
import { shareFinanceCsv } from '../../finances/export-csv';
import { FilterSheet } from '../../finances/filter-sheet';
import { OwedSpotlight } from '../../finances/owed-spotlight';
import { FinanceSearch } from '../../finances/finance-search';
import { QuickFilters } from '../../finances/quick-filters';
import { FinanceTimeline } from '../../finances/timeline';
import { timelineGroups } from '../../finances/timeline-groups';
import { WalletCard, type Period } from '../../finances/wallet-card';
import { barShare, categoryIcon, monthLabel } from '../../finances/wallet-helpers';
import {
  ActionButton,
  Avatar,
  CategoryBadge,
  Money,
  Panel,
  PanelTitle,
  Segmented,
  TxRow,
} from '../../finances/wallet-ui';
import { SpokeHeader } from '../spoke-header';

type View_ = 'overview' | 'owed' | 'entries';

/**
 * The band's money as a wallet: a card with the band fund and the period's
 * money in and out, the two things people come here to do (log an expense,
 * log income) right under it, then three short views instead of one long
 * scroll. Entries (where it opens) is every entry as a searchable, filterable
 * timeline, Owed is who the band owes and for what, Overview is the reports.
 */
export function FinancesSpoke({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const me = useMe(true);
  const visible = can('finance.view');
  const [period, setPeriod] = useState<Period>('month');
  const [view, setView] = useState<View_>('entries');
  const range = useMemo(() => {
    const range = monthToDate();
    return period === 'all'
      ? {}
      : period === 'year'
        ? { ...range, from: `${range.from.slice(0, 4)}-01-01` }
        : range;
  }, [period]);
  const periodLabel =
    period === 'month' ? 'this month' : period === 'year' ? 'this year' : 'all time';
  const summary = useFinanceSummary(boardId, range, visible);
  const entries = useFinanceEntries(boardId);
  const data = summary.data;
  const money = (cents: number) => formatMoney(cents, data?.currency ?? 'USD');
  const name = (userId: string) =>
    data?.members.find((m) => m.id === userId)?.displayName ?? 'Former member';
  const myId = me.data?.user.id;
  const add = (kind: 'EXPENSE' | 'INCOME') =>
    router.push(`/board/${boardId}/form/finance?money=${kind}`);

  return (
    <SpokeList
      pending={visible && (summary.isPending || entries.isPending)}
      error={summary.error ?? entries.error}
      onRetry={() => {
        void summary.refetch();
        void entries.refetch();
      }}
      empty={!visible}
      emptyIcon={{ sf: 'dollarsign.circle', md: 'account-balance-wallet' }}
      emptyTitle="Only admins see the books"
      header={
        <SpokeHeader
          boardId={boardId}
          widgetType="FINANCES"
          summary={
            data
              ? data.balances.owedCents > 0
                ? `Band owes members ${money(data.balances.owedCents)}`
                : 'Everyone’s square'
              : null
          }
        />
      }
    >
      {data && (
        <View style={{ gap: spacing.md }}>
          <WalletCard
            boardId={boardId}
            currency={data.currency}
            bandFundCents={data.balances.bandFundCents}
            incomeCents={data.totals.incomeCents}
            expenseCents={data.totals.expenseCents}
            netCents={data.totals.netCents}
            period={period}
            onPeriod={setPeriod}
          />

          {can('finance.create') && (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <ActionButton
                primary
                label="Add expense"
                icon={{ sf: 'minus', md: 'remove' }}
                onPress={() => add('EXPENSE')}
              />
              <ActionButton
                label="Add income"
                icon={{ sf: 'plus', md: 'add' }}
                onPress={() => add('INCOME')}
              />
            </View>
          )}

          <View style={{ marginTop: spacing.xs }}>
            <Segmented<View_>
              label="Finances view"
              value={view}
              onChange={setView}
              options={[
                { value: 'entries', label: 'Entries' },
                {
                  value: 'owed',
                  label: 'Owed',
                  // The to-do count, as on the spoke's chip: admins pay back.
                  badge: can('finance.manage') ? data.owed.length : undefined,
                },
                { value: 'overview', label: 'Overview' },
              ]}
            />
          </View>

          {view === 'overview' && (
            <Overview
              data={data}
              periodLabel={periodLabel}
              money={money}
              onOwed={() => setView('owed')}
            />
          )}
          {view === 'owed' && (
            <OwedSpotlight
              boardId={boardId}
              data={data}
              myId={myId}
              manages={can('finance.manage')}
            />
          )}
          {view === 'entries' && (
            <Entries
              boardId={boardId}
              currency={data.currency}
              entries={entries.data ?? []}
              members={data.members}
              myId={myId}
              name={name}
            />
          )}
        </View>
      )}
    </SpokeList>
  );
}

/** Who the band owes, then where the money went this period, then month by month. */
function Overview({
  data,
  periodLabel,
  money,
  onOwed,
}: {
  data: FinanceSummaryDto;
  periodLabel: string;
  money: (cents: number) => string;
  onOwed: () => void;
}) {
  const tokens = useTokens();
  const income = data.totals.byCategory.filter((c) => c.kind === 'INCOME');
  const expense = data.totals.byCategory.filter((c) => c.kind === 'EXPENSE');
  const owedMembers = data.balances.members.filter((m) => m.owedCents > 0);

  return (
    <View style={{ gap: spacing.md }}>
      <OwedBanner
        data={data}
        owedMembers={owedMembers.map((m) => ({
          id: m.userId,
          displayName:
            data.members.find((member) => member.id === m.userId)?.displayName ?? 'Former member',
        }))}
        money={money}
        onPress={onOwed}
      />

      {income.length + expense.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <PanelTitle title="By category" caption={periodLabel} />
          <Panel>
            {[
              ...income.map((c) => ({ ...c, group: 'Money in' })),
              ...expense.map((c) => ({ ...c, group: 'Money out' })),
            ].map((cat, index, all) => {
              const groupStart = index === 0 || all[index - 1].kind !== cat.kind;
              const max = Math.max(...all.filter((c) => c.kind === cat.kind).map((c) => c.cents));
              return (
                <View key={cat.category}>
                  {groupStart && (
                    <PosterText
                      variant="label"
                      color={tokens.mutedForeground}
                      style={{
                        paddingHorizontal: spacing.sm + 2,
                        paddingTop: index === 0 ? spacing.sm : spacing.md,
                        paddingBottom: spacing.xs,
                      }}
                    >
                      {cat.group.toUpperCase()}
                    </PosterText>
                  )}
                  <CategoryLine
                    label={categoryLabel(cat.category)}
                    cents={cat.cents}
                    share={barShare(cat.cents, max)}
                    income={cat.kind === 'INCOME'}
                    category={cat.category}
                    currency={data.currency}
                  />
                </View>
              );
            })}
          </Panel>
        </View>
      ) : (
        <Panel padded>
          <PosterText variant="body" color={tokens.mutedForeground} style={{ textAlign: 'center' }}>
            {`Nothing logged ${periodLabel} yet.`}
          </PosterText>
        </Panel>
      )}

      {data.totals.byMonth.length > 1 && (
        <View style={{ gap: spacing.sm }}>
          <PanelTitle title="Month by month" caption={periodLabel} />
          <Panel>
            {[...data.totals.byMonth].reverse().map((month, index) => {
              const net = month.incomeCents - month.expenseCents;
              return (
                <TxRow
                  key={month.month}
                  first={index === 0}
                  lead={
                    <CategoryBadge icon={{ sf: 'calendar', md: 'calendar-month' }} income={false} />
                  }
                  title={monthLabel(month.month)}
                  meta={`In ${money(month.incomeCents)} · out ${money(month.expenseCents)}`}
                  trailing={
                    <Money
                      cents={net}
                      currency={data.currency}
                      tone={net > 0 ? 'in' : net < 0 ? 'out' : 'plain'}
                    />
                  }
                />
              );
            })}
          </Panel>
        </View>
      )}
    </View>
  );
}

/** A category's total with a bar for its share of the biggest one. */
function CategoryLine({
  label,
  cents,
  share,
  income,
  category,
  currency,
}: {
  label: string;
  cents: number;
  share: number;
  income: boolean;
  category: string;
  currency: string;
}) {
  const tokens = useTokens();
  const green = FINANCE_COLORS[useScheme()].positive;
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${formatMoney(cents, currency)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 4,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.sm,
      }}
    >
      <CategoryBadge
        icon={categoryIcon(category, income ? 'INCOME' : 'EXPENSE')}
        income={income}
        size={36}
      />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <PosterText
            variant="rowTitle"
            color={tokens.foreground}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {label}
          </PosterText>
          <Money cents={cents} currency={currency} tone={income ? 'in' : 'out'} />
        </View>
        <View style={{ height: 6, borderRadius: radius.full, backgroundColor: tokens.muted }}>
          <View
            style={{
              width: `${Math.round(share * 100)}%`,
              height: 6,
              borderRadius: radius.full,
              backgroundColor: income ? green : tokens.mutedForeground,
            }}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * What the band owes, in one tappable line on the Overview: whose faces, how
 * much. Opens the Owed view.
 */
function OwedBanner({
  data,
  owedMembers,
  money,
  onPress,
}: {
  data: FinanceSummaryDto;
  owedMembers: FinanceMemberRef[];
  money: (cents: number) => string;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const shadows = useShadows();
  const finance = FINANCE_COLORS[useScheme()];
  const owed = data.balances.owedCents;
  const count = data.owed.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Shows who the band owes"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 4,
        padding: spacing.md,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        backgroundColor: pressed ? tokens.accent : tokens.card,
        boxShadow: shadows.card,
      })}
    >
      {owed > 0 ? (
        <View style={{ flexDirection: 'row' }}>
          {owedMembers.slice(0, 3).map((m, i) => (
            <View
              key={m.id}
              style={{
                marginLeft: i === 0 ? 0 : -12,
                borderRadius: radius.full,
                borderWidth: 2,
                borderColor: tokens.card,
              }}
            >
              <Avatar name={m.displayName} size={34} owed />
            </View>
          ))}
        </View>
      ) : (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: radius.full,
            backgroundColor: `${finance.positive}1f`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={{ sf: 'checkmark', md: 'check' }} size={18} color={finance.positive} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <PosterText variant="rowTitle" color={tokens.foreground}>
          {owed > 0 ? `Band owes ${money(owed)}` : 'Everyone’s square'}
        </PosterText>
        <PosterText variant="cardMeta" color={tokens.mutedForeground}>
          {owed > 0
            ? `${owedMembers.length} ${owedMembers.length === 1 ? 'member' : 'members'} · ${count} ${count === 1 ? 'expense' : 'expenses'}`
            : 'Nobody is waiting to be paid back.'}
        </PosterText>
      </View>
      <Icon
        name={{ sf: 'chevron.right', md: 'chevron-right' }}
        size={16}
        color={tokens.mutedForeground}
      />
    </Pressable>
  );
}

/**
 * Every entry the band has logged, as the timeline: search, quick filters
 * (the rest in the filter sheet), the count with Export CSV, then one feed
 * month by month with each month's total. Tapping an entry opens it.
 */
function Entries({
  boardId,
  currency,
  entries,
  members,
  myId,
  name,
}: {
  boardId: string;
  currency: string;
  entries: FinanceEntryDto[];
  members: FinanceMemberRef[];
  myId: string | undefined;
  name: (userId: string) => string;
}) {
  const tokens = useTokens();
  const [filters, setFilters] = useState(DEFAULT_FINANCE_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const rows = filterFinanceEntries(entries, filters);
  const groups = timelineGroups(rows, filters.sort);
  const narrowed = activeFinanceFilterCount(filters) > 0 || filters.query.trim() !== '';
  const net = ledgerTotals(rows).netCents;

  if (entries.length === 0) {
    return (
      <Panel padded>
        <PosterText variant="body" color={tokens.mutedForeground} style={{ textAlign: 'center' }}>
          Nothing logged yet.
        </PosterText>
      </Panel>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <FinanceSearch
        value={filters.query}
        onChange={(query) => setFilters({ ...filters, query })}
      />
      <QuickFilters
        filters={filters}
        onChange={setFilters}
        onOpenSheet={() => setSheetOpen(true)}
        members={members}
        me={myId}
      />
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
          {`${rows.length} of ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}${
            narrowed ? ` · net ${formatMoney(net, currency)}` : ''
          }`}
        </PosterText>
        <Button
          title="Export CSV"
          variant="secondary"
          size="sm"
          onPress={() => void shareFinanceCsv(rows, members, narrowed ? 'filtered' : 'all-time')}
        />
      </View>
      {rows.length === 0 ? (
        <Panel padded>
          <PosterText variant="body" color={tokens.mutedForeground} style={{ textAlign: 'center' }}>
            Nothing matches this search and these filters.
          </PosterText>
        </Panel>
      ) : (
        <FinanceTimeline
          groups={groups}
          currency={currency}
          sort={filters.sort}
          name={name}
          onOpen={(entry) => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
        />
      )}
      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        resultCount={rows.length}
        members={members}
      />
    </View>
  );
}
