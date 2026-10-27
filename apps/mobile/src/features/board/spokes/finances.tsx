import { View } from 'react-native';
import { router } from 'expo-router';
import { useFinanceEntries, useFinanceSummary, useMe, usePermissions } from '@artist/api-client';
import {
  categoryLabel,
  formatMoney,
  monthToDate,
  DEFAULT_FINANCE_FILTERS,
  FINANCE_CATEGORIES,
  FINANCE_SORTS,
  filterFinanceEntries,
  type FinanceSort,
} from '@artist/shared';
import { useMemo, useState } from 'react';
import { Button } from '@/components/button';
import { PickOne } from '@/components/pick-one';
import { ChoiceChips } from '@/components/choice-chips';
import { MemberHistory } from '../../finances/member-history';
import { FinanceAmount } from '../../finances/finance-amount';
import { PosterText } from '@/components/poster-text';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { SpokeList } from '@/components/spoke-list';
import { spacing, usePosterCanvas } from '@/theme';
import { shortDate } from '../format';
import { SpokeHeader } from '../spoke-header';

/**
 * The band's money for the selected period: the net, who is owed what, shows still owing,
 * and the latest entries. Logging is the header's + (members too); splits,
 * payments and reports are on web, where there's room for a table.
 */
export function FinancesSpoke({ boardId }: { boardId: string }) {
  const canvas = usePosterCanvas();
  const { can } = usePermissions();
  const me = useMe(true);
  const visible = can('finance.view');
  const [period, setPeriod] = useState('month');
  const [filters, setFilters] = useState(DEFAULT_FINANCE_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
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
  const entries = useFinanceEntries(boardId, range);
  const data = summary.data;
  const money = (cents: number) => formatMoney(cents, data?.currency ?? 'USD');
  const name = (userId: string) =>
    data?.members.find((m) => m.id === userId)?.displayName ?? 'Former member';
  const rows = filterFinanceEntries(entries.data ?? [], filters);
  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => value !== DEFAULT_FINANCE_FILTERS[key as keyof typeof filters],
  ).length;
  const owedMembers = (data?.members ?? [])
    .map((member) => ({
      member,
      cents: data?.balances.members.find((b) => b.userId === member.id)?.balanceCents ?? 0,
    }))
    .filter(({ cents }) => cents > 0);

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
            <Figure label="OUT" cents={-data.totals.expenseCents} currency={data.currency} />
            <Figure label="NET" cents={data.totals.netCents} currency={data.currency} />
            <Figure
              label="BAND FUND"
              cents={data.balances.bandFundCents}
              currency={data.currency}
            />
          </View>

          {data.unpaidShows.length > 0 && (
            <Section title="SHOWS STILL OWING">
              {data.unpaidShows.map((show, index) => (
                <Row
                  key={show.eventId}
                  first={index === 0}
                  title={show.title}
                  meta={shortDate(show.startsAt)}
                  trailing={money(show.expectedCents)}
                  onPress={() => router.push(`/board/${boardId}/event/${show.eventId}`)}
                />
              ))}
            </Section>
          )}

          <Section title="WHO'S OWED · ALL TIME">
            {owedMembers.length === 0 && (
              <PosterText variant="cardMeta" color={canvas.soft}>
                Nobody is owed money right now.
              </PosterText>
            )}
            {owedMembers.map(({ member, cents }, index) => {
              return (
                <View key={member.id}>
                  <Row
                    first={index === 0}
                    title={
                      member.id === me.data?.user.id
                        ? `${member.displayName} (you)`
                        : member.displayName
                    }
                    meta={
                      selectedMember === member.id
                        ? 'Hide expenses and payouts'
                        : 'View expenses and payouts'
                    }
                    trailing={money(cents)}
                    onPress={() =>
                      setSelectedMember(selectedMember === member.id ? null : member.id)
                    }
                  />
                  {selectedMember === member.id && (
                    <MemberHistory boardId={boardId} userId={member.id} currency={data.currency} />
                  )}
                </View>
              );
            })}
          </Section>

          <Section title="ENTRIES">
            <Button
              title={`${filtersOpen ? 'Hide' : 'Filter / sort'}${activeFilters ? ` (${activeFilters})` : ''}`}
              variant="secondary"
              onPress={() => setFiltersOpen(!filtersOpen)}
            />
            {filtersOpen && (
              <View style={{ gap: spacing.md, paddingVertical: spacing.md }}>
                <PickOne
                  label="Type"
                  noneLabel="All types"
                  value={filters.kind === 'all' ? null : filters.kind}
                  options={[
                    { value: 'INCOME', label: 'Income' },
                    { value: 'EXPENSE', label: 'Expenses' },
                  ]}
                  onChange={(value) => setFilters({ ...filters, kind: value ?? 'all' })}
                />
                <PickOne
                  label="Handled by"
                  noneLabel="All members"
                  value={filters.member === 'all' ? null : filters.member}
                  options={[
                    { value: 'band', label: 'Band account' },
                    ...data.members.map((m) => ({ value: m.id, label: m.displayName })),
                  ]}
                  onChange={(value) => setFilters({ ...filters, member: value ?? 'all' })}
                />
                <PickOne
                  label="Category"
                  noneLabel="All categories"
                  value={filters.category === 'all' ? null : filters.category}
                  options={FINANCE_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
                  onChange={(value) => setFilters({ ...filters, category: value ?? 'all' })}
                />
                <PickOne
                  label="Status"
                  noneLabel="All statuses"
                  value={filters.state === 'all' ? null : filters.state}
                  options={[
                    { value: 'SETTLED', label: 'Settled' },
                    { value: 'EXPECTED', label: 'Expected' },
                  ]}
                  onChange={(value) => setFilters({ ...filters, state: value ?? 'all' })}
                />
                <PickOne
                  label="Sort"
                  noneLabel="Newest first"
                  value={filters.sort === 'newest' ? null : filters.sort}
                  options={FINANCE_SORTS.filter((s) => s.value !== 'newest').map((s) => ({ ...s }))}
                  onChange={(value) =>
                    setFilters({ ...filters, sort: (value ?? 'newest') as FinanceSort })
                  }
                />
                <Button
                  title="Reset filters"
                  variant="ghost"
                  onPress={() => {
                    setFilters(DEFAULT_FINANCE_FILTERS);
                    setPeriod('month');
                  }}
                />
              </View>
            )}
            <PosterText variant="cardMeta" color={canvas.soft}>
              {rows.length} entries · {periodLabel}
            </PosterText>
            {rows.length === 0 ? (
              <PosterText variant="cardMeta" color={canvas.soft}>
                {activeFilters
                  ? 'No entries match these filters.'
                  : 'Nothing logged for this period.'}
              </PosterText>
            ) : (
              rows.map((entry, index) => (
                <Row
                  key={entry.id}
                  first={index === 0}
                  title={entry.description || categoryLabel(entry.category)}
                  meta={[
                    shortDate(`${entry.occurredOn}T12:00:00`),
                    entry.state === 'EXPECTED' ? 'owed' : null,
                    entry.handledById ? name(entry.handledById) : null,
                    entry.receiptCount > 0 ? 'receipt' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <FinanceAmount
                      cents={entry.kind === 'INCOME' ? entry.amountCents : -entry.amountCents}
                      currency={data.currency}
                      signed
                    />
                  }
                  onPress={() => router.push(`/board/${boardId}/form/finance?id=${entry.id}`)}
                />
              ))
            )}
          </Section>
        </View>
      )}
    </SpokeList>
  );
}

function Figure({ label, cents, currency }: { label: string; cents: number; currency: string }) {
  const canvas = usePosterCanvas();
  return (
    <View style={{ flexGrow: 1, flexBasis: '40%', gap: 2 }}>
      <PosterText variant="label" color={canvas.soft}>
        {label}
      </PosterText>
      <FinanceAmount cents={cents} currency={currency} />
    </View>
  );
}
