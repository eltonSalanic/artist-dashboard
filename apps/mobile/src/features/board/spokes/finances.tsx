import { View } from 'react-native';
import { router } from 'expo-router';
import {
  useFinanceEntries,
  useFinanceSummary,
  useMe,
  usePermissions,
} from '@artist/api-client';
import { categoryLabel, formatMoney, monthToDate } from '@artist/shared';
import { useMemo, useState } from 'react';
import { Button } from '@/components/button';
import { ChoiceChips } from '@/components/choice-chips';
import { FinanceAmount } from '../../finances/finance-amount';
import { FinanceEntryRow } from '../../finances/entry-row';
import { PosterText } from '@/components/poster-text';
import { Row } from '@/components/row';
import { SectionCard } from '@/components/section-card';
import { SpokeList } from '@/components/spoke-list';
import { spacing, useTokens } from '@/theme';
import { shortDate } from '../format';
import { SpokeHeader } from '../spoke-header';

/** How many of the latest entries the page shows before "All entries". */
const RECENT = 5;

/**
 * The band's money for the selected period: the totals and the band fund, what
 * the band owes members who paid out of pocket (tap someone for everything
 * they paid), month and category reports, and the latest entries, with the
 * full searchable list a tap away. Logging is the header's + (members too);
 * admins pay members back from an expense or from the member's page.
 */
export function FinancesSpoke({ boardId }: { boardId: string }) {
  const tokens = useTokens();
  const { can } = usePermissions();
  const me = useMe(true);
  const visible = can('finance.view');
  const [period, setPeriod] = useState('month');
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
  const recent = (entries.data ?? []).slice(0, RECENT);
  const myId = me.data?.user.id;

  // Everyone who has paid for something, most owed first, then today's
  // members who haven't, so any member's page is one tap away.
  const people = (data?.members ?? [])
    .map((member) => ({
      member,
      balance: data?.balances.members.find((b) => b.userId === member.id),
    }))
    .sort(
      (a, b) =>
        (b.balance?.owedCents ?? 0) - (a.balance?.owedCents ?? 0) ||
        (b.balance?.paidCents ?? 0) - (a.balance?.paidCents ?? 0) ||
        a.member.displayName.localeCompare(b.member.displayName),
    );

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
          summary={data ? `${money(data.totals.netCents)} net · ${periodLabel}` : null}
        />
      }
    >
      {data && (
        <View style={{ gap: spacing.lg }}>
          {/* A card per group, as board settings does: with several groups of
              rows and nothing between them but air, small caps captions
              didn't tell one from the next. */}
          <SectionCard title="Overview">
            <View
              style={{ gap: spacing.lg, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}
            >
              <ChoiceChips
                label="Period"
                value={period}
                onChange={setPeriod}
                choices={[
                  { value: 'month', label: 'This month' },
                  { value: 'year', label: 'This year' },
                  { value: 'all', label: 'All time' },
                ]}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
                <Figure label="IN" cents={data.totals.incomeCents} currency={data.currency} />
                <Figure label="OUT" cents={0 - data.totals.expenseCents || 0} currency={data.currency} />
                <Figure label="NET" cents={data.totals.netCents} currency={data.currency} />
                <Figure
                  label="BAND FUND"
                  cents={data.balances.bandFundCents}
                  currency={data.currency}
                />
              </View>
            </View>
          </SectionCard>

          <SectionCard
            title="Who's owed"
            caption={
              data.balances.owedCents > 0
                ? `Band owes ${money(data.balances.owedCents)}`
                : 'All time'
            }
            description="Members are owed only what they paid for out of pocket, until it's paid back. Tap anyone for everything they've paid for."
          >
            {people.map(({ member, balance }, index) => {
              const owed = balance?.owedCents ?? 0;
              const owedCount = data.owed.filter((e) => e.handledById === member.id).length;
              return (
                <Row
                  key={member.id}
                  first={index === 0}
                  title={member.id === myId ? `${member.displayName} (you)` : member.displayName}
                  meta={
                    owed > 0
                      ? `${owedCount} ${owedCount === 1 ? 'expense' : 'expenses'} owed back`
                      : balance && balance.paidCents > 0
                        ? `All paid back · ${money(balance.paidCents)} paid in total`
                        : 'Hasn’t paid for anything'
                  }
                  trailing={
                    owed > 0 ? (
                      <FinanceAmount cents={-owed} currency={data.currency} />
                    ) : (
                      <PosterText variant="cardMeta" color={tokens.mutedForeground}>
                        Square
                      </PosterText>
                    )
                  }
                  onPress={() => router.push(`/board/${boardId}/finances/member/${member.id}`)}
                />
              );
            })}
          </SectionCard>

          {data.owed.length > 0 && (
            <SectionCard
              title="Owed back"
              caption={`${data.owed.length} ${data.owed.length === 1 ? 'expense' : 'expenses'}`}
              description={
                can('finance.manage')
                  ? 'Open one to pay the member back from the band fund.'
                  : undefined
              }
            >
              {data.owed.map((entry, index) => (
                <Row
                  key={entry.id}
                  first={index === 0}
                  title={entry.description || categoryLabel(entry.category)}
                  meta={`${entry.handledById ? name(entry.handledById) : 'Band'} paid · ${shortDate(`${entry.occurredOn}T12:00:00`)}`}
                  trailing={money(entry.amountCents)}
                  onPress={() => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
                />
              ))}
            </SectionCard>
          )}

          {data.totals.byMonth.length > 1 && (
            <SectionCard title="Month by month" caption={periodLabel}>
              {[...data.totals.byMonth].reverse().map((month, index) => (
                <Row
                  key={month.month}
                  first={index === 0}
                  title={monthLabel(month.month)}
                  meta={`In ${money(month.incomeCents)} · out ${money(month.expenseCents)}`}
                  trailing={
                    <FinanceAmount
                      cents={month.incomeCents - month.expenseCents}
                      currency={data.currency}
                      signed
                    />
                  }
                />
              ))}
            </SectionCard>
          )}

          {data.totals.byCategory.length > 0 && (
            <SectionCard title="By category" caption={periodLabel}>
              {data.totals.byCategory.map((cat, index) => (
                <Row
                  key={cat.category}
                  first={index === 0}
                  title={categoryLabel(cat.category)}
                  trailing={
                    <FinanceAmount
                      cents={cat.kind === 'INCOME' ? cat.cents : -cat.cents}
                      currency={data.currency}
                      signed
                    />
                  }
                />
              ))}
            </SectionCard>
          )}

          <SectionCard
            title="All entries"
            caption={`${entries.data?.length ?? 0} in total`}
            description="Every income and expense. Search by name, or filter by category, amount or who paid."
          >
            {recent.length === 0 ? (
              <PosterText variant="cardMeta" color={tokens.mutedForeground} style={inset}>
                Nothing logged yet.
              </PosterText>
            ) : (
              recent.map((entry, index) => (
                <FinanceEntryRow
                  key={entry.id}
                  entry={entry}
                  currency={data.currency}
                  first={index === 0}
                  name={name}
                  onPress={() => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
                />
              ))
            )}
            {recent.length > 0 && (
              <View style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.sm }}>
                <Button
                  title="Search all entries"
                  variant="secondary"
                  onPress={() => router.push(`/board/${boardId}/finances/entries`)}
                />
              </View>
            )}
          </SectionCard>
        </View>
      )}
    </SpokeList>
  );
}

/** `2026-10` → "October 2026". */
function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/** Lines up loose text with a `Row`'s, which is inset by its own padding. */
const inset = { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs };

function Figure({ label, cents, currency }: { label: string; cents: number; currency: string }) {
  const tokens = useTokens();
  return (
    <View style={{ flexGrow: 1, flexBasis: '40%', gap: 2 }}>
      <PosterText variant="label" color={tokens.mutedForeground}>
        {label}
      </PosterText>
      <FinanceAmount cents={cents} currency={currency} />
    </View>
  );
}
