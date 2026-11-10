import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  categoryLabel,
  formatMoney,
  paybackStatus,
  type FinanceEntryDto,
  type FinanceSort,
} from '@artist/shared';
import { PosterText } from '@/components/poster-text';
import { posterRadius, spacing, useShadows, useTokens } from '@/theme';
import { FinanceAmount } from './finance-amount';
import { PaybackLabel } from './payback-label';
import {
  dayLabel,
  dayParts,
  monthLabel,
  type TimelineDay,
  type TimelineGroup,
} from './timeline-groups';

/** The date column's width: a two-digit day in the `title` face, with air. */
const DATE_WIDTH = 40;

/**
 * The ledger as one running feed: a header per month with what came in, what
 * went out and the net, then that month's entries as a card, newest first,
 * split by day: each day gets a slim header with its date and, on a day with
 * more than one entry, that day's net, then its entries. Sorted by amount, the
 * dates jump around, so it's one group without day headers and every row
 * carries its own date.
 *
 * `totals` picks the month header: `net` for the band's books, `spent` for one
 * member's expenses, where "net" would only ever be a minus.
 */
export function FinanceTimeline({
  groups,
  currency,
  sort,
  name,
  showPayer = true,
  totals = 'net',
  onOpen,
}: {
  groups: TimelineGroup[];
  currency: string;
  sort: FinanceSort;
  name: (userId: string) => string;
  showPayer?: boolean;
  totals?: 'net' | 'spent';
  onOpen: (entry: FinanceEntryDto) => void;
}) {
  const row = (entry: FinanceEntryDto, dated: boolean, rule: 'none' | 'full' | 'inset') => (
    <TimelineRow
      key={entry.id}
      entry={entry}
      currency={currency}
      date={dated ? 'month' : null}
      rule={rule}
      name={name}
      showPayer={showPayer}
      plainAmount={totals === 'spent'}
      onPress={() => onOpen(entry)}
    />
  );
  return (
    <View style={{ gap: spacing.lg }}>
      {groups.map((group) => (
        <View key={group.month ?? 'sorted'} style={{ gap: spacing.sm }}>
          <MonthHeader group={group} currency={currency} sort={sort} totals={totals} />
          <TimelineCard>
            {group.month
              ? group.days.map((day, d) => (
                  <Fragment key={`${day.day}-${d}`}>
                    <DayHeader
                      day={day}
                      currency={currency}
                      plain={totals === 'spent'}
                      first={d === 0}
                    />
                    {day.entries.map((entry, i) => row(entry, false, i === 0 ? 'none' : 'inset'))}
                  </Fragment>
                ))
              : // A list sorted by amount has no day headers: each row says its date.
                group.days.flatMap((day, d) =>
                  day.entries.map((entry, i) =>
                    row(entry, true, d === 0 && i === 0 ? 'none' : 'full'),
                  ),
                )}
          </TimelineCard>
        </View>
      ))}
    </View>
  );
}

/** The flat card a month's rows sit on. */
export function TimelineCard({ children }: { children: ReactNode }) {
  const tokens = useTokens();
  const shadows = useShadows();
  return (
    <View
      style={{
        backgroundColor: tokens.card,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        boxShadow: shadows.card,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function MonthHeader({
  group,
  currency,
  sort,
  totals,
}: {
  group: TimelineGroup;
  currency: string;
  sort: FinanceSort;
  totals: 'net' | 'spent';
}) {
  const tokens = useTokens();
  const money = (cents: number) => formatMoney(cents, currency);
  const t = group.totals;
  const title = group.month
    ? monthLabel(group.month)
    : sort === 'highest'
      ? 'Biggest first'
      : 'Smallest first';
  const detail =
    totals === 'spent'
      ? `${group.count} ${group.count === 1 ? 'expense' : 'expenses'}`
      : [
          `${money(t.incomeCents)} in`,
          `${money(t.expenseCents)} out`,
          t.expectedCents > 0 ? `${money(t.expectedCents)} expected` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${title}. ${
        totals === 'spent' ? `${money(t.expenseCents)} paid` : `Net ${money(t.netCents)}`
      }. ${detail}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.sm,
        paddingHorizontal: spacing.xs,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <PosterText variant="title" color={tokens.foreground}>
          {title}
        </PosterText>
        <PosterText variant="cardMeta" color={tokens.mutedForeground} numberOfLines={2}>
          {detail}
        </PosterText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <PosterText variant="label" color={tokens.mutedForeground}>
          {totals === 'spent' ? 'PAID' : 'NET'}
        </PosterText>
        {totals === 'spent' ? (
          <PosterText variant="rowTitle" color={tokens.foreground}>
            {money(t.expenseCents)}
          </PosterText>
        ) : (
          <FinanceAmount cents={t.netCents} currency={currency} signed />
        )}
      </View>
    </View>
  );
}

/**
 * A day's slim header inside the month's card: the date on the left and, on a
 * day with more than one entry, the day's net on the right, above the amounts
 * under it (on a one-entry day it would only repeat that row). Expected money
 * isn't in the net, so it's named beside it.
 */
function DayHeader({
  day,
  currency,
  plain,
  first,
}: {
  day: TimelineDay;
  currency: string;
  /** One member's expenses: what they paid that day, without sign or colour. */
  plain: boolean;
  first: boolean;
}) {
  const tokens = useTokens();
  const t = day.totals;
  const several = day.entries.length > 1;
  const settled = day.entries.some((entry) => entry.state === 'SETTLED');
  const expected =
    t.expectedCents > 0 ? `${formatMoney(t.expectedCents, currency)} expected` : null;
  const label = dayLabel(day.day);

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={[
        label,
        several && plain ? `${formatMoney(t.expenseCents, currency)} paid` : null,
        several && !plain && settled ? `net ${formatMoney(t.netCents, currency)}` : null,
        several && !plain ? expected : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 24,
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        // A faint band of the ink: the day's rows read as one block under it,
        // like a list's section header.
        backgroundColor: `${tokens.foreground}0d`,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: tokens.border,
      }}
    >
      <PosterText variant="label" color={tokens.mutedForeground} style={{ flex: 1 }}>
        {label.toUpperCase()}
      </PosterText>
      {several && plain && (
        <PosterText variant="cardMeta" color={tokens.foreground} numberOfLines={1}>
          {formatMoney(t.expenseCents, currency)}
        </PosterText>
      )}
      {several && !plain && expected && (
        <PosterText variant="cardMeta" color={tokens.mutedForeground} numberOfLines={1}>
          {settled ? `${expected} ·` : expected}
        </PosterText>
      )}
      {several && !plain && settled && (
        <FinanceAmount cents={t.netCents} currency={currency} signed variant="cardMeta" />
      )}
    </View>
  );
}

/**
 * One entry on the timeline: the date (first of its day only), what it was
 * for, who paid and who was paid, the signed amount, and Owed back / Paid back
 * on an out-of-pocket expense. Tapping opens its form.
 */
export function TimelineRow({
  entry,
  currency,
  date,
  rule,
  name,
  showPayer = true,
  plainAmount = false,
  onPress,
}: {
  entry: FinanceEntryDto;
  currency: string;
  /**
   * The date column, day and month, for a list sorted by amount; null under a
   * day header, which already says the date.
   */
  date: 'month' | null;
  /** The hairline above: none for the first row, inset within a day. */
  rule: 'none' | 'full' | 'inset';
  name: (userId: string) => string;
  showPayer?: boolean;
  /**
   * The amount without a sign or colour: on a member's own list every row is
   * money they paid, and a red minus there reads as money they owe.
   */
  plainAmount?: boolean;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const status = paybackStatus(entry);
  const parts = dayParts(entry.occurredOn);
  const meta = [
    entry.state === 'EXPECTED' ? 'Expected' : null,
    showPayer && entry.handledById ? `${name(entry.handledById)} paid` : null,
    // Who was paid (or paid the band) says more than the category.
    entry.counterparty ?? (entry.description ? categoryLabel(entry.category) : null),
    entry.receiptCount > 0 ? 'receipt' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        `${parts.weekday} ${parts.month} ${parts.day}`,
        entry.description || categoryLabel(entry.category),
        `${entry.kind === 'INCOME' ? 'in' : 'out'} ${formatMoney(entry.amountCents, currency)}`,
        meta,
        status === 'owed' ? 'Owed back' : status === 'paid' ? 'Paid back' : null,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderTopWidth: rule === 'full' ? StyleSheet.hairlineWidth : 0,
        borderTopColor: tokens.border,
        backgroundColor: pressed ? tokens.accent : undefined,
      })}
    >
      {date && (
        <View style={{ width: DATE_WIDTH, alignItems: 'center', paddingTop: spacing.sm + 2 }}>
          <PosterText variant="title" color={tokens.foreground}>
            {parts.day}
          </PosterText>
          <PosterText variant="label" color={tokens.mutedForeground}>
            {parts.month.toUpperCase()}
          </PosterText>
        </View>
      )}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 56,
          paddingVertical: spacing.sm + 2,
          borderTopWidth: rule === 'inset' ? StyleSheet.hairlineWidth : 0,
          borderTopColor: tokens.border,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <PosterText variant="rowTitle" color={tokens.foreground} numberOfLines={2}>
            {entry.description || categoryLabel(entry.category)}
          </PosterText>
          {meta !== '' && (
            <PosterText variant="cardMeta" color={tokens.mutedForeground} numberOfLines={2}>
              {meta}
            </PosterText>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          {plainAmount ? (
            <PosterText variant="rowTitle" color={tokens.foreground}>
              {formatMoney(entry.amountCents, currency)}
            </PosterText>
          ) : (
            <FinanceAmount
              cents={entry.kind === 'INCOME' ? entry.amountCents : -entry.amountCents}
              currency={currency}
              signed
            />
          )}
          {status && <PaybackLabel status={status} />}
        </View>
      </View>
    </Pressable>
  );
}
