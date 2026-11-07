import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { FINANCE_COLORS, formatMoney } from '@artist/shared';
import { Icon, type IconName } from '@/components/icon';
import { PosterText, type PosterVariant } from '@/components/poster-text';
import { radius, spacing, useScheme, useShadows, useTokens } from '@/theme';
import { initials } from './wallet-helpers';

/**
 * The small kit the Finances screens share, after a banking app: a segmented
 * control, a white panel of rows, a round avatar or category badge at the
 * start of each row, and amounts coloured by what they mean.
 */

export interface Segment<T extends string> {
  value: T;
  label: string;
  /** A count to act on, drawn as a small pill after the label. */
  badge?: number;
}

/** The colours a segmented control paints with when it sits on a dark card. */
export interface SegmentInk {
  track: string;
  thumb: string;
  label: string;
  activeLabel: string;
}

/**
 * One of a few views, iOS's segmented control: a grey track with the chosen
 * segment lifted out of it as a white pill. Every option is always visible, so
 * nobody has to guess what's behind a menu.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  ink,
  size = 'md',
}: {
  /** Names the group to a screen reader. */
  label: string;
  options: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  ink?: SegmentInk;
  size?: 'sm' | 'md';
}) {
  const tokens = useTokens();
  const shadows = useShadows();
  const colors = ink ?? {
    track: tokens.muted,
    thumb: tokens.card,
    label: tokens.mutedForeground,
    activeLabel: tokens.foreground,
  };
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: radius.full,
        backgroundColor: colors.track,
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              option.badge ? `${option.label}, ${option.badge} to act on` : option.label
            }
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs + 2,
              minHeight: size === 'sm' ? 32 : 38,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: active ? colors.thumb : 'transparent',
              boxShadow: active && !ink ? shadows.card : undefined,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <PosterText
              variant="chip"
              numberOfLines={1}
              color={active ? colors.activeLabel : colors.label}
              style={size === 'sm' ? { fontSize: 13 } : undefined}
            >
              {option.label}
            </PosterText>
            {option.badge ? <CountPill count={option.badge} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A small red count, as on an app icon: things waiting on someone. */
export function CountPill({ count }: { count: number }) {
  const red = FINANCE_COLORS[useScheme()].negative;
  return (
    <View
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: radius.full,
        backgroundColor: red,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PosterText variant="meta" color="#ffffff" style={{ fontSize: 11, lineHeight: 14 }}>
        {count > 99 ? '99+' : String(count)}
      </PosterText>
    </View>
  );
}

/** A white card that holds a list of rows, like a bank's list of transactions. */
export function Panel({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  const tokens = useTokens();
  const shadows = useShadows();
  return (
    <View
      style={{
        backgroundColor: tokens.card,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        paddingHorizontal: padded ? spacing.md : spacing.xs,
        paddingVertical: padded ? spacing.md : spacing.xs,
        boxShadow: shadows.card,
      }}
    >
      {children}
    </View>
  );
}

/**
 * The line over a panel: a bold name on the left and, optionally, a quiet
 * caption or a "See all" link on the right.
 */
export function PanelTitle({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string | null;
  action?: { label: string; onPress: () => void };
}) {
  const tokens = useTokens();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.sm,
        paddingHorizontal: spacing.xs,
        marginTop: spacing.xs,
      }}
    >
      <PosterText
        variant="title"
        color={tokens.foreground}
        accessibilityRole="header"
        style={{ flex: 1 }}
      >
        {title}
      </PosterText>
      {caption ? (
        <PosterText variant="cardMeta" color={tokens.mutedForeground}>
          {caption}
        </PosterText>
      ) : null}
      {action ? (
        <Pressable accessibilityRole="link" hitSlop={10} onPress={action.onPress}>
          {({ pressed }) => (
            <PosterText
              variant="chip"
              color={tokens.primary}
              style={{ opacity: pressed ? 0.6 : 1, textDecorationLine: 'underline' }}
            >
              {action.label}
            </PosterText>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** A member's initials in a circle. Red-tinted when the band owes them. */
export function Avatar({
  name,
  size = 40,
  owed = false,
}: {
  name: string;
  size?: number;
  owed?: boolean;
}) {
  const tokens = useTokens();
  const red = FINANCE_COLORS[useScheme()].negative;
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: owed ? `${red}1f` : tokens.muted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <PosterText
        variant="chip"
        color={owed ? red : tokens.foreground}
        style={{ fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.46) }}
      >
        {initials(name)}
      </PosterText>
    </View>
  );
}

/** A transaction's category as an icon in a circle: green-tinted for money in. */
export function CategoryBadge({
  icon,
  income,
  size = 40,
}: {
  icon: IconName;
  income: boolean;
  size?: number;
}) {
  const tokens = useTokens();
  const green = FINANCE_COLORS[useScheme()].positive;
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: income ? `${green}1f` : tokens.muted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={income ? green : tokens.foreground} />
    </View>
  );
}

export type MoneyTone = 'in' | 'out' | 'owed' | 'plain';

/**
 * An amount as a bank shows it: money in is green with a plus, money out is a
 * plain minus, and only what the band owes a member is red. Red is kept for
 * the one thing that needs doing, so it never means "an ordinary expense".
 */
export function Money({
  cents,
  currency,
  tone,
  variant = 'rowTitle',
  color,
}: {
  /** Always the size of the amount; `tone` says which way it went. */
  cents: number;
  currency: string;
  tone: MoneyTone;
  variant?: PosterVariant;
  /** Overrides the tone's colour (on a dark card). */
  color?: string;
}) {
  const tokens = useTokens();
  const finance = FINANCE_COLORS[useScheme()];
  const amount = formatMoney(Math.abs(cents), currency);
  const text =
    tone === 'in' && cents !== 0
      ? `+${amount}`
      : tone === 'out' && cents !== 0
        ? `−${amount}`
        : amount;
  const ink =
    color ??
    (tone === 'in' && cents !== 0
      ? finance.positive
      : tone === 'owed' && cents !== 0
        ? finance.negative
        : tokens.foreground);
  return (
    <PosterText variant={variant} color={ink} style={{ fontVariant: ['tabular-nums'] }}>
      {text}
    </PosterText>
  );
}

/**
 * One transaction: a round badge, what it was and a quiet line under it, and
 * the amount with its label on the right.
 */
export function TxRow({
  lead,
  title,
  meta,
  trailing,
  first,
  onPress,
  accessibilityLabel,
}: {
  lead: ReactNode;
  title: string;
  meta?: string | null;
  trailing?: ReactNode;
  first: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const tokens = useTokens();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 4,
        minHeight: 64,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.sm + 2,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: pressed ? tokens.accent : 'transparent',
      })}
    >
      {lead}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          alignSelf: 'stretch',
        }}
      >
        <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
          <PosterText variant="rowTitle" color={tokens.foreground} numberOfLines={2}>
            {title}
          </PosterText>
          {meta ? (
            <PosterText variant="cardMeta" color={tokens.mutedForeground} numberOfLines={1}>
              {meta}
            </PosterText>
          ) : null}
        </View>
        {trailing}
      </View>
      {/* A hairline between rows that starts after the badge, as in iOS lists. */}
      {!first && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 62,
            right: spacing.sm + 2,
            height: 1,
            backgroundColor: tokens.border,
          }}
        />
      )}
    </Pressable>
  );
}

/** A small pill with an icon: Filters, Export. Filled while what it opens is open. */
export function ChipButton({
  label,
  icon,
  onPress,
  active = false,
  count,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  active?: boolean;
  /** How many filters are on, after the label. */
  count?: number;
}) {
  const tokens = useTokens();
  const fg = active ? tokens.background : tokens.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} on` : label}
      accessibilityState={{ expanded: active }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        minHeight: 38,
        paddingHorizontal: spacing.md - 2,
        borderRadius: radius.full,
        backgroundColor: active ? tokens.foreground : tokens.muted,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={15} color={fg} />
      <PosterText variant="chip" color={fg} numberOfLines={1}>
        {label}
      </PosterText>
      {count ? <CountPill count={count} /> : null}
    </Pressable>
  );
}

/** A primary or quiet capsule with an icon, for the actions under the wallet card. */
export function ActionButton({
  label,
  icon,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const tokens = useTokens();
  const shadows = useShadows();
  const fg = primary ? tokens.primaryForeground : tokens.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs + 2,
        minHeight: 48,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        backgroundColor: primary ? tokens.primary : tokens.card,
        boxShadow: primary ? undefined : shadows.card,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      <Icon name={icon} size={18} color={fg} />
      <PosterText variant="caption" color={fg} numberOfLines={1}>
        {label}
      </PosterText>
    </Pressable>
  );
}
