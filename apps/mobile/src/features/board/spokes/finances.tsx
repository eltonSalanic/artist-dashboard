import { View } from 'react-native';
import { router } from 'expo-router';
import {
  useFinanceEntries,
  useFinanceSummary,
  useMe,
  usePermissions,
} from '@artist/api-client';
import { categoryLabel, formatMoney, monthToDate } from '@artist/shared';
import { useMemo } from 'react';
import { PosterText } from '@/components/poster-text';
import { Row } from '@/components/row';
import { Section } from '@/components/section';
import { SpokeList } from '@/components/spoke-list';
import { spacing, usePosterCanvas } from '@/theme';
import { shortDate } from '../format';
import { SpokeHeader } from '../spoke-header';

/**
 * The band's money this month: the net, who is owed what, shows still owing,
 * and the latest entries. Logging is the header's + (members too); splits,
 * payments and reports are on web, where there's room for a table.
 */
export function FinancesSpoke({ boardId }: { boardId: string }) {
  const canvas = usePosterCanvas();
  const { can } = usePermissions();
  const me = useMe(true);
  const visible = can('finance.view');
  const month = useMemo(() => monthToDate(), []);
  const summary = useFinanceSummary(boardId, month, visible);
  const entries = useFinanceEntries(boardId, month);
  const data = summary.data;
  const money = (cents: number) => formatMoney(cents, data?.currency ?? 'USD');
  const name = (userId: string) =>
    data?.members.find((m) => m.id === userId)?.displayName ?? 'Former member';
  const rows = entries.data ?? [];

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
          summary={data ? `${money(data.totals.netCents)} net this month` : null}
        />
      }
    >
      {data && (
        <View style={{ gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <Figure label="IN" value={money(data.totals.incomeCents)} color={canvas.ink} />
            <Figure label="OUT" value={money(data.totals.expenseCents)} color={canvas.ink} />
            <Figure
              label="BAND FUND"
              value={money(data.balances.bandFundCents)}
              color={canvas.ink}
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

          <Section title="WHO'S OWED">
            {data.members.map((member, index) => {
              const cents =
                data.balances.members.find((b) => b.userId === member.id)?.balanceCents ?? 0;
              return (
                <Row
                  key={member.id}
                  first={index === 0}
                  title={member.id === me.data?.user.id ? `${member.displayName} (you)` : member.displayName}
                  meta={cents > 0 ? 'band owes them' : cents < 0 ? 'owes the band' : 'settled up'}
                  trailing={money(Math.abs(cents))}
                />
              );
            })}
          </Section>

          <Section title="THIS MONTH">
            {rows.length === 0 ? (
              <PosterText variant="cardMeta" color={canvas.soft}>
                Nothing logged yet this month.
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
                  trailing={`${entry.kind === 'INCOME' ? '+' : '−'}${money(entry.amountCents)}`}
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

function Figure({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <PosterText variant="label" color={color}>
        {label}
      </PosterText>
      <PosterText variant="rowTitle" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </PosterText>
    </View>
  );
}
