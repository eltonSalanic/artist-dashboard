import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { router } from 'expo-router';
import {
  categoryLabel,
  formatMoney,
  type FinanceEntryDto,
  type FinanceSummaryDto,
} from '@artist/shared';
import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { radius, spacing, useScheme, useShadows, useTokens } from '@/theme';
import { shortDate } from '../board/format';
import {
  expenseCount,
  firstName,
  joinNames,
  owedPeople,
  type OwedPerson,
  type OwedStanding,
} from './owed-spotlight-helpers';
import { categoryIcon } from './wallet-helpers';
import { Avatar, CategoryBadge, Money, Panel, PanelTitle, TxRow } from './wallet-ui';
import { MONEY_COLORS } from '@/theme/money-colors';

/**
 * Who's owed, people first: a grid of faces at the top (a red ring and
 * the amount when the band owes them, a tick when they're square), and a
 * spotlight under it on whoever is picked. "Everyone" (where it opens) is the
 * band's total and every expense still to pay back, person by person; a
 * person is what the band owes them, their mini statement, their unpaid
 * expenses and a way into their full statement. Picking never leaves the tab.
 */

const EVERYONE = 'everyone';
const APPEAR = FadeIn.duration(200).reduceMotion(ReduceMotion.System);

export function OwedSpotlight({
  boardId,
  data,
  myId,
  manages,
}: {
  boardId: string;
  data: FinanceSummaryDto;
  myId: string | undefined;
  manages: boolean;
}) {
  const tokens = useTokens();
  const [picked, setPicked] = useState<string>(EVERYONE);
  const people = owedPeople(data, myId);
  const person = people.find((p) => p.id === picked);
  const total = data.balances.owedCents;
  const owedTo = people.filter((p) => p.standing === 'owed').length;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <PanelTitle
          title="Who's owed"
          caption={
            total > 0 ? `${owedTo} ${owedTo === 1 ? 'person' : 'people'} owed` : 'All square'
          }
        />
        <PosterText
          variant="cardMeta"
          color={tokens.mutedForeground}
          style={{ paddingHorizontal: spacing.xs }}
        >
          A member is owed what they paid for out of their own pocket, until it’s paid back. Tap a
          face to see theirs.
        </PosterText>
      </View>

      <FaceGrid
        people={people}
        picked={person ? person.id : EVERYONE}
        onPick={setPicked}
        totalCents={total}
        owedCount={data.owed.length}
        currency={data.currency}
      />

      <Animated.View key={person?.id ?? EVERYONE} entering={APPEAR}>
        {person ? (
          <PersonSpotlight
            boardId={boardId}
            person={person}
            currency={data.currency}
            manages={manages}
          />
        ) : (
          <EveryoneSpotlight
            boardId={boardId}
            people={people}
            totalCents={total}
            owedCount={data.owed.length}
            currency={data.currency}
            manages={manages}
            onPick={setPicked}
          />
        )}
      </Animated.View>
    </View>
  );
}

/**
 * A member's face as the spotlight draws it: their initials in a circle, a red
 * ring with the amount on a tab under it while the band owes them, a tick at
 * the corner once they're square (green when they've been paid back, grey when
 * they never paid for anything). `squareRing` also rings a paid-back face in
 * green, for the member page's hero. `icon` swaps the initials for a picture, for
 * "Everyone". `cutout` is the colour behind the face, so the tab and the tick
 * read as cut out of the ring.
 */
export function SpotlightFace({
  name,
  icon,
  size,
  standing,
  amount,
  cutout,
  squareRing = false,
}: {
  name: string;
  icon?: IconName;
  size: number;
  standing: OwedStanding;
  amount?: string;
  cutout: string;
  squareRing?: boolean;
}) {
  const tokens = useTokens();
  const scheme = useScheme();
  const finance = MONEY_COLORS[scheme];
  const owed = standing === 'owed';
  const ring = Math.max(2, Math.round(size / 24));
  const inner = size - ring * 2 - Math.round(size / 16) * 2;
  const tick = Math.round(size * 0.34);
  // White on the light scheme's deep red and green; the dark scheme's are
  // pale, so they take the canvas's near-black instead.
  const onInk = scheme === 'dark' ? tokens.background : '#ffffff';
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.full,
          borderWidth: ring,
          borderColor: owed
            ? finance.negative
            : squareRing && standing === 'paidBack'
              ? finance.positive
              : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon ? (
          <View
            style={{
              width: inner,
              height: inner,
              borderRadius: radius.full,
              backgroundColor: tokens.foreground,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={Math.round(inner * 0.46)} color={tokens.background} />
          </View>
        ) : (
          <Avatar name={name} size={inner} owed={owed} />
        )}
      </View>
      {owed && amount ? (
        <View
          style={{
            position: 'absolute',
            left: -spacing.md,
            right: -spacing.md,
            bottom: -Math.round(size * 0.16),
            alignItems: 'center',
          }}
        >
          <View
            style={{
              paddingHorizontal: spacing.sm - 1,
              paddingVertical: 1,
              borderRadius: radius.full,
              borderWidth: 2,
              borderColor: cutout,
              backgroundColor: finance.negative,
            }}
          >
            <PosterText
              variant="meta"
              color={onInk}
              numberOfLines={1}
              style={{
                fontSize: size >= 80 ? 15 : 12,
                lineHeight: size >= 80 ? 20 : 16,
                fontVariant: ['tabular-nums'],
              }}
            >
              {amount}
            </PosterText>
          </View>
        </View>
      ) : null}
      {!owed ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: tick,
            height: tick,
            borderRadius: radius.full,
            borderWidth: 2,
            borderColor: cutout,
            backgroundColor: standing === 'paidBack' ? finance.positive : tokens.mutedForeground,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={{ sf: 'checkmark', md: 'check' }}
            size={Math.round(tick * 0.55)}
            color={onInk}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The faces across the top, Everyone first, four to a row, wrapping onto more rows. */
function FaceGrid({
  people,
  picked,
  onPick,
  totalCents,
  owedCount,
  currency,
}: {
  people: OwedPerson[];
  picked: string;
  onPick: (id: string) => void;
  totalCents: number;
  owedCount: number;
  currency: string;
}) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Who to show"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: spacing.xs,
        marginHorizontal: -spacing.xs,
        paddingVertical: spacing.xs,
      }}
    >
      <FaceTab
        label="Everyone"
        sub={totalCents > 0 ? expenseCount(owedCount) : 'All square'}
        name="Everyone"
        icon={{ sf: 'person.3.fill', md: 'groups' }}
        standing={totalCents > 0 ? 'owed' : 'paidBack'}
        amount={formatMoney(totalCents, currency)}
        accessibilityLabel={
          totalCents > 0
            ? `Everyone: the band owes ${formatMoney(totalCents, currency)} for ${expenseCount(owedCount)}`
            : 'Everyone: all square'
        }
        selected={picked === EVERYONE}
        onPress={() => onPick(EVERYONE)}
      />
      {people.map((p) => (
        <FaceTab
          key={p.id}
          label={p.you ? `${firstName(p.name)} (you)` : firstName(p.name)}
          sub={p.standing === 'owed' ? expenseCount(p.owedEntries.length) : 'Square'}
          name={p.name}
          standing={p.standing}
          amount={formatMoney(p.owedCents, currency)}
          accessibilityLabel={`${p.name}${p.you ? ' (you)' : ''}: ${
            p.standing === 'owed'
              ? `owed ${formatMoney(p.owedCents, currency)} for ${expenseCount(p.owedEntries.length)}`
              : p.standing === 'paidBack'
                ? 'square, all paid back'
                : 'square, hasn’t paid for anything'
          }`}
          selected={picked === p.id}
          onPress={() => onPick(p.id)}
        />
      ))}
    </View>
  );
}

/** One face in the grid. The picked one stands on a card, like a lifted tab. */
function FaceTab({
  label,
  sub,
  name,
  icon,
  standing,
  amount,
  accessibilityLabel,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  name: string;
  icon?: IconName;
  standing: OwedStanding;
  amount: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const shadows = useShadows();
  const behind = selected ? tokens.card : tokens.background;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '25%',
        alignItems: 'center',
        paddingTop: spacing.sm + 4,
        paddingBottom: spacing.sm + 2,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        backgroundColor: selected ? tokens.card : pressed ? tokens.muted : 'transparent',
        boxShadow: selected ? shadows.card : undefined,
      })}
    >
      <SpotlightFace
        name={name}
        icon={icon}
        size={64}
        standing={standing}
        amount={amount}
        cutout={behind}
      />
      <PosterText
        variant="chip"
        color={tokens.foreground}
        numberOfLines={1}
        style={{ marginTop: spacing.md + 2, fontSize: 13 }}
      >
        {label}
      </PosterText>
      <PosterText
        variant="meta"
        color={tokens.mutedForeground}
        numberOfLines={1}
        style={{ fontSize: 12, lineHeight: 15 }}
      >
        {sub}
      </PosterText>
    </Pressable>
  );
}

/**
 * Everyone: the band's total, then every expense still to pay back, one card
 * per person (tap their name to spotlight them, an expense to open it), then
 * who's square.
 */
function EveryoneSpotlight({
  boardId,
  people,
  totalCents,
  owedCount,
  currency,
  manages,
  onPick,
}: {
  boardId: string;
  people: OwedPerson[];
  totalCents: number;
  owedCount: number;
  currency: string;
  manages: boolean;
  onPick: (id: string) => void;
}) {
  const tokens = useTokens();
  const finance = MONEY_COLORS[useScheme()];
  const owed = people.filter((p) => p.standing === 'owed');
  const paidBack = people.filter((p) => p.standing === 'paidBack');
  const nothing = people.filter((p) => p.standing === 'nothing');
  const named = (p: OwedPerson) => (p.you ? `${p.name} (you)` : p.name);
  const squareLines = [
    paidBack.length > 0
      ? `${joinNames(paidBack.map(named))} ${paidBack.length === 1 ? 'is' : 'are'} all paid back.`
      : null,
    nothing.length > 0
      ? `${joinNames(nothing.map(named))} ${nothing.length === 1 ? 'hasn’t' : 'haven’t'} paid for anything.`
      : null,
  ].filter(Boolean);

  return (
    <View style={{ gap: spacing.md }}>
      <Panel padded>
        <View style={{ gap: spacing.xs }}>
          <PosterText variant="label" color={tokens.mutedForeground}>
            {totalCents > 0 ? 'THE BAND OWES' : 'EVERYONE'}
          </PosterText>
          {totalCents > 0 ? (
            <PosterText
              variant="display"
              color={finance.negative}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatMoney(totalCents, currency)}
            </PosterText>
          ) : (
            <SquareFigure />
          )}
          <PosterText variant="cardMeta" color={tokens.mutedForeground}>
            {totalCents > 0
              ? `In all, to ${owed.length} ${owed.length === 1 ? 'person' : 'people'} for ${expenseCount(owedCount)}.`
              : 'Nobody is waiting to be paid back.'}
          </PosterText>
        </View>
      </Panel>

      {owed.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <PanelTitle title="To pay back" caption={expenseCount(owedCount)} />
          <PosterText
            variant="cardMeta"
            color={tokens.mutedForeground}
            style={{ paddingHorizontal: spacing.xs }}
          >
            {manages
              ? 'Open an expense to pay it back from the band fund.'
              : 'An admin pays these back from the band fund.'}
          </PosterText>
        </View>
      )}

      {owed.map((p) => (
        <Panel key={p.id}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${named(p)}: owed ${formatMoney(p.owedCents, currency)}`}
            accessibilityHint="Shows them in the spotlight"
            onPress={() => onPick(p.id)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm + 2,
              paddingHorizontal: spacing.sm + 2,
              paddingTop: spacing.sm + 2,
              paddingBottom: spacing.xs,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: pressed ? tokens.accent : 'transparent',
            })}
          >
            <Avatar name={p.name} size={28} owed />
            <PosterText
              variant="caption"
              color={tokens.foreground}
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {named(p)}
            </PosterText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Money cents={p.owedCents} currency={currency} tone="owed" variant="caption" />
              <Icon
                name={{ sf: 'chevron.right', md: 'chevron-right' }}
                size={14}
                color={tokens.mutedForeground}
              />
            </View>
          </Pressable>
          {p.owedEntries.map((entry, index) => (
            <OwedRow
              key={entry.id}
              boardId={boardId}
              entry={entry}
              currency={currency}
              first={index === 0}
            />
          ))}
        </Panel>
      ))}

      {squareLines.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
            paddingHorizontal: spacing.xs,
          }}
        >
          <Icon
            name={{ sf: 'checkmark.circle.fill', md: 'check-circle' }}
            size={16}
            color={finance.positive}
          />
          <PosterText variant="cardMeta" color={tokens.mutedForeground} style={{ flex: 1 }}>
            {squareLines.join(' ')}
          </PosterText>
        </View>
      )}
    </View>
  );
}

/**
 * One person in the spotlight: what the band owes them, their mini statement,
 * the expenses not paid back yet, and the way to their full statement (where
 * admins pay everything back at once).
 */
function PersonSpotlight({
  boardId,
  person,
  currency,
  manages,
}: {
  boardId: string;
  person: OwedPerson;
  currency: string;
  manages: boolean;
}) {
  const tokens = useTokens();
  const finance = MONEY_COLORS[useScheme()];
  const money = (cents: number) => formatMoney(cents, currency);
  const owed = person.standing === 'owed';
  const first = firstName(person.name);
  const them = person.you ? 'you' : first;

  return (
    <Panel padded>
      <View style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <PosterText variant="label" color={tokens.mutedForeground}>
            {owed
              ? `THE BAND OWES ${them.toUpperCase()}`
              : person.you
                ? `${person.name} (you)`.toUpperCase()
                : person.name.toUpperCase()}
          </PosterText>
          {owed ? (
            <PosterText
              variant="display"
              color={finance.negative}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {money(person.owedCents)}
            </PosterText>
          ) : (
            <SquareFigure />
          )}
          <PosterText variant="cardMeta" color={tokens.mutedForeground}>
            {owed
              ? `${expenseCount(person.owedEntries.length)}, not paid back yet.`
              : person.standing === 'paidBack'
                ? `Everything ${person.you ? 'you' : 'they'} paid for has been paid back.`
                : `${person.you ? 'You haven’t' : `${first} hasn’t`} paid for anything out of pocket.`}
          </PosterText>
        </View>

        <StatTiles
          paidCents={person.paidCents}
          paidBackCents={person.paidBackCents}
          owedCents={person.owedCents}
          currency={currency}
          compact
        />

        {owed && (
          <View style={{ gap: spacing.xs }}>
            <PosterText variant="label" color={tokens.mutedForeground}>
              NOT PAID BACK YET
            </PosterText>
            <View style={{ marginHorizontal: -(spacing.sm + 2) }}>
              {person.owedEntries.map((entry, index) => (
                <OwedRow
                  key={entry.id}
                  boardId={boardId}
                  entry={entry}
                  currency={currency}
                  first={index === 0}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: spacing.xs }}>
          <Button
            title={person.you ? 'Open your full statement' : `Open ${first}’s full statement`}
            variant="secondary"
            onPress={() => router.push(`/board/${boardId}/finances/member/${person.id}`)}
          />
          {manages && owed && (
            <PosterText
              variant="cardMeta"
              color={tokens.mutedForeground}
              style={{ textAlign: 'center' }}
            >
              Pay back everything there, or one expense above.
            </PosterText>
          )}
        </View>
      </View>
    </Panel>
  );
}

/** "Square" in big type with a green tick, for anyone the band owes nothing. */
function SquareFigure() {
  const tokens = useTokens();
  const finance = MONEY_COLORS[useScheme()];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon
        name={{ sf: 'checkmark.circle.fill', md: 'check-circle' }}
        size={30}
        color={finance.positive}
      />
      <PosterText variant="display" color={tokens.foreground}>
        Square
      </PosterText>
    </View>
  );
}

/**
 * Paid for the band, paid back, still owed: the statement as three tiles side
 * by side. Still owed is red while it's above zero.
 */
export function StatTiles({
  paidCents,
  paidBackCents,
  owedCents,
  currency,
  you = false,
  compact = false,
}: {
  paidCents: number;
  paidBackCents: number;
  owedCents: number;
  currency: string;
  you?: boolean;
  compact?: boolean;
}) {
  const tokens = useTokens();
  const finance = MONEY_COLORS[useScheme()];
  const tiles = [
    { label: 'Paid for the band', cents: paidCents, color: tokens.foreground },
    {
      label: you ? 'Paid back to you' : 'Paid back',
      cents: paidBackCents,
      color: tokens.foreground,
    },
    {
      label: 'Still owed',
      cents: owedCents,
      color: owedCents > 0 ? finance.negative : tokens.foreground,
    },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {tiles.map((tile) => (
        <View
          key={tile.label}
          accessible
          accessibilityLabel={`${tile.label}: ${formatMoney(tile.cents, currency)}`}
          style={{
            flex: 1,
            gap: 2,
            paddingHorizontal: spacing.sm + 4,
            paddingVertical: compact ? spacing.sm + 2 : spacing.md - 2,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: compact ? tokens.muted : tokens.card,
          }}
        >
          <PosterText
            variant="caption"
            color={tile.color}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatMoney(tile.cents, currency)}
          </PosterText>
          <PosterText variant="meta" color={tokens.mutedForeground} numberOfLines={2}>
            {tile.label}
          </PosterText>
        </View>
      ))}
    </View>
  );
}

/** An expense still to pay back: tap to open it (admins pay it back there). */
function OwedRow({
  boardId,
  entry,
  currency,
  first,
}: {
  boardId: string;
  entry: FinanceEntryDto;
  currency: string;
  first: boolean;
}) {
  const tokens = useTokens();
  const title = entry.description || categoryLabel(entry.category);
  const meta = [
    shortDate(`${entry.occurredOn}T12:00:00`),
    entry.counterparty ?? (entry.description ? categoryLabel(entry.category) : null),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <TxRow
      first={first}
      lead={<CategoryBadge icon={categoryIcon(entry.category, entry.kind)} income={false} />}
      title={title}
      meta={meta}
      accessibilityLabel={`${title}, ${formatMoney(entry.amountCents, currency)}, ${meta}, owed back`}
      trailing={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Money cents={entry.amountCents} currency={currency} tone="owed" />
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
}
