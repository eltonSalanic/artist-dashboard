import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useFinanceEntries, useFinanceSummary, useMe, usePermissions } from '@artist/api-client';
import {
  categoryLabel,
  FINANCE_COLORS,
  formatMoney,
  monthToDate,
  type FinanceMemberRef,
  type FinanceSummaryDto,
} from '@artist/shared';
import { useMemo, useState } from 'react';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { SpokeList } from '@/components/spoke-list';
import { radius, spacing, useScheme, useShadows, useTokens } from '@/theme';
import { FinanceEntryRow } from '../../finances/entry-row';
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
import { shortDate } from '../format';
import { SpokeHeader } from '../spoke-header';

/** How many of the latest entries the Entries view shows before "See all". */
const RECENT = 6;

type View_ = 'overview' | 'owed' | 'entries';

/**
 * The band's money as a wallet: a card with the band fund and the period's
 * money in and out, the two things people come here to do (log an expense,
 * log income) right under it, then three short views instead of one long
 * scroll. Overview is the reports, Owed is who the band owes and for what,
 * Entries is the latest transactions with the full searchable list a tap away.
 */
export function FinancesSpoke({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const me = useMe(true);
  const visible = can('finance.view');
  const [period, setPeriod] = useState<Period>('month');
  const [view, setView] = useState<View_>('overview');
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
                { value: 'overview', label: 'Overview' },
                {
                  value: 'owed',
                  label: 'Owed',
                  // The to-do count, as on the spoke's chip: admins pay back.
                  badge: can('finance.manage') ? data.owed.length : undefined,
                },
                { value: 'entries', label: 'Entries' },
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
            <Owed
              boardId={boardId}
              data={data}
              myId={myId}
              name={name}
              money={money}
              manages={can('finance.manage')}
            />
          )}
          {view === 'entries' && (
            <Entries
              boardId={boardId}
              currency={data.currency}
              entries={entries.data ?? []}
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
 * Who the band owes: a card per member (tap for their statement), then every
 * expense still to pay back (tap to open it, and for admins, pay it back).
 */
function Owed({
  boardId,
  data,
  myId,
  name,
  money,
  manages,
}: {
  boardId: string;
  data: FinanceSummaryDto;
  myId: string | undefined;
  name: (userId: string) => string;
  money: (cents: number) => string;
  manages: boolean;
}) {
  const tokens = useTokens();
  // Everyone who has paid for something, most owed first, then today's
  // members who haven't, so any member's page is one tap away.
  const people = data.members
    .map((member) => ({
      member,
      balance: data.balances.members.find((b) => b.userId === member.id),
    }))
    .sort(
      (a, b) =>
        (b.balance?.owedCents ?? 0) - (a.balance?.owedCents ?? 0) ||
        (b.balance?.paidCents ?? 0) - (a.balance?.paidCents ?? 0) ||
        a.member.displayName.localeCompare(b.member.displayName),
    );
  const pairs: (typeof people)[] = [];
  for (let i = 0; i < people.length; i += 2) pairs.push(people.slice(i, i + 2));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <PanelTitle
          title="Who's owed"
          caption={
            data.balances.owedCents > 0 ? `${money(data.balances.owedCents)} in all` : 'All square'
          }
        />
        <PosterText
          variant="cardMeta"
          color={tokens.mutedForeground}
          style={{ paddingHorizontal: spacing.xs }}
        >
          A member is owed what they paid for out of their own pocket, until it’s paid back. Tap
          anyone for their statement.
        </PosterText>
      </View>
      <View style={{ gap: spacing.sm }}>
        {pairs.map((pair) => (
          <View key={pair[0].member.id} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {pair.map(({ member, balance }) => (
              <MemberCard
                key={member.id}
                name={member.id === myId ? `${member.displayName} (you)` : member.displayName}
                rawName={member.displayName}
                owedCents={balance?.owedCents ?? 0}
                paidCents={balance?.paidCents ?? 0}
                owedCount={data.owed.filter((e) => e.handledById === member.id).length}
                currency={data.currency}
                onPress={() => router.push(`/board/${boardId}/finances/member/${member.id}`)}
              />
            ))}
            {pair.length === 1 && <View style={{ flex: 1 }} />}
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
        <PanelTitle
          title="To pay back"
          caption={`${data.owed.length} ${data.owed.length === 1 ? 'expense' : 'expenses'}`}
        />
        {manages && data.owed.length > 0 && (
          <PosterText
            variant="cardMeta"
            color={tokens.mutedForeground}
            style={{ paddingHorizontal: spacing.xs }}
          >
            Open one to pay the member back from the band fund.
          </PosterText>
        )}
      </View>
      <Panel padded={data.owed.length === 0}>
        {data.owed.length === 0 ? (
          <PosterText variant="body" color={tokens.mutedForeground} style={{ textAlign: 'center' }}>
            Nothing to pay back.
          </PosterText>
        ) : (
          data.owed.map((entry, index) => {
            const payer = entry.handledById ? name(entry.handledById) : 'Band';
            return (
              <TxRow
                key={entry.id}
                first={index === 0}
                lead={<Avatar name={payer} owed />}
                title={entry.description || categoryLabel(entry.category)}
                meta={`${payer} paid · ${shortDate(`${entry.occurredOn}T12:00:00`)}`}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Money cents={entry.amountCents} currency={data.currency} tone="owed" />
                    <Icon
                      name={{ sf: 'chevron.right', md: 'chevron-right' }}
                      size={14}
                      color={tokens.mutedForeground}
                    />
                  </View>
                }
                onPress={() => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
              />
            );
          })
        )}
      </Panel>
    </View>
  );
}

function MemberCard({
  name,
  rawName,
  owedCents,
  paidCents,
  owedCount,
  currency,
  onPress,
}: {
  name: string;
  rawName: string;
  owedCents: number;
  paidCents: number;
  owedCount: number;
  currency: string;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const shadows = useShadows();
  const owed = owedCents > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${owed ? `owed ${formatMoney(owedCents, currency)}` : 'square'}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        gap: spacing.sm,
        padding: spacing.md - 2,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        backgroundColor: pressed ? tokens.accent : tokens.card,
        boxShadow: shadows.card,
      })}
    >
      <Avatar name={rawName} size={36} owed={owed} />
      <View style={{ gap: 2 }}>
        <PosterText variant="chip" color={tokens.foreground} numberOfLines={1}>
          {name}
        </PosterText>
        {owed ? (
          <Money cents={owedCents} currency={currency} tone="owed" variant="title" />
        ) : (
          <PosterText variant="title" color={tokens.mutedForeground}>
            Square
          </PosterText>
        )}
        <PosterText variant="meta" color={tokens.mutedForeground} numberOfLines={1}>
          {owed
            ? `${owedCount} ${owedCount === 1 ? 'expense' : 'expenses'} owed`
            : paidCents > 0
              ? 'All paid back'
              : 'Hasn’t paid for anything'}
        </PosterText>
      </View>
    </Pressable>
  );
}

/** The latest transactions, and the way into the full list. */
function Entries({
  boardId,
  currency,
  entries,
  name,
}: {
  boardId: string;
  currency: string;
  entries: Parameters<typeof FinanceEntryRow>[0]['entry'][];
  name: (userId: string) => string;
}) {
  const tokens = useTokens();
  const recent = entries.slice(0, RECENT);
  const all = () => router.push(`/board/${boardId}/finances/entries`);
  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Search all entries"
        onPress={all}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 46,
          paddingHorizontal: spacing.md,
          borderRadius: radius.full,
          backgroundColor: tokens.muted,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon
          name={{ sf: 'magnifyingglass', md: 'search' }}
          size={16}
          color={tokens.mutedForeground}
        />
        <PosterText variant="field" color={tokens.mutedForeground} style={{ flex: 1 }}>
          Search, filter or export
        </PosterText>
        <Icon
          name={{ sf: 'slider.horizontal.3', md: 'tune' }}
          size={16}
          color={tokens.mutedForeground}
        />
      </Pressable>

      <PanelTitle title="Latest" caption={`${entries.length} in total`} />
      <Panel padded={recent.length === 0}>
        {recent.length === 0 ? (
          <PosterText variant="body" color={tokens.mutedForeground} style={{ textAlign: 'center' }}>
            Nothing logged yet.
          </PosterText>
        ) : (
          recent.map((entry, index) => (
            <FinanceEntryRow
              key={entry.id}
              entry={entry}
              currency={currency}
              first={index === 0}
              name={name}
              onPress={() => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
            />
          ))
        )}
      </Panel>
      {entries.length > 0 && (
        <Button
          title={`See all ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
          variant="secondary"
          onPress={all}
        />
      )}
    </View>
  );
}
