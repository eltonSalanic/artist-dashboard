import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { Skeleton } from '@/components/skeleton';
import {
  posterRadius,
  shadows,
  spacing,
  usePosterCanvas,
  useThemeColors,
  type WidgetInk,
} from '@/theme';

/**
 * The top of a task, event or goal: one block in the colour of the widget it
 * belongs to, so the screen reads as the calendar block or the widget card you
 * tapped, opened up. A show is the Shows colour, a task its To-Do's.
 *
 * The kind is written in small caps across the top, so the colour never says
 * it alone; `aside` takes the top right ("In 4 days", "Archived").
 */
export function DetailPoster({
  ink,
  label,
  aside,
  title,
  done = false,
  children,
}: {
  ink: WidgetInk;
  label: string;
  aside?: string | null;
  title: string;
  /** A finished task or goal: struck through, still legible. */
  done?: boolean;
  /** What follows the title on the block: the when, the status, a button. */
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: ink.bg,
        borderRadius: posterRadius.block,
        borderCurve: 'continuous',
        padding: spacing.md + 2,
        gap: spacing.sm,
        boxShadow: ink.plain ? shadows.card : shadows.raised,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <PosterText variant="label" color={ink.ink} style={{ flex: 1 }}>
          {label.toUpperCase()}
        </PosterText>
        {aside ? (
          <PosterText variant="label" color={ink.soft}>
            {aside.toUpperCase()}
          </PosterText>
        ) : null}
      </View>
      <PosterText
        variant="statement"
        color={ink.ink}
        accessibilityRole="header"
        style={done ? { textDecorationLine: 'line-through', opacity: 0.7 } : undefined}
      >
        {title}
      </PosterText>
      {children}
    </View>
  );
}

/** A quieter line on the block: a time, a place, a due date. */
export function PosterMeta({ ink, children }: { ink: WidgetInk; children: string }) {
  return (
    <PosterText variant="body" color={ink.soft}>
      {children}
    </PosterText>
  );
}

/**
 * A control on the block, as a capsule in the block's own ink: filled for the
 * one thing the screen is for (completing a goal), outlined otherwise. Set in
 * the block's colours rather than the app's primary, which on a coloured block
 * is a colour nobody checked against it.
 */
export function PosterPill({
  ink,
  label,
  lead,
  filled = false,
  chevron = false,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  onPress,
}: {
  ink: WidgetInk;
  label: string;
  lead?: ReactNode;
  filled?: boolean;
  /** Says the pill opens a choice (the status sheet). */
  chevron?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  /** Without one the pill is a label: same shape, no press. */
  onPress?: () => void;
}) {
  const fg = filled ? ink.bg : ink.ink;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={onPress ? { disabled } : undefined}
      disabled={!onPress || disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        minHeight: 36,
        paddingHorizontal: spacing.md - 2,
        borderRadius: posterRadius.chip,
        borderWidth: 2,
        borderColor: ink.ink,
        backgroundColor: filled ? ink.ink : 'transparent',
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {lead}
      <PosterText variant="chip" color={fg} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </PosterText>
      {chevron && <Icon name={{ sf: 'chevron.down', md: 'expand-more' }} size={12} color={fg} />}
    </Pressable>
  );
}

/** The block's shape while the item loads, so nothing jumps when it lands. */
export function DetailLoading() {
  const canvas = usePosterCanvas();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: canvas.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      <Skeleton width="100%" height={150} style={{ borderRadius: posterRadius.block }} />
      <Skeleton width="80%" height={16} />
      <Skeleton width="100%" height={60} />
    </ScrollView>
  );
}

/**
 * The item is gone, or is not yours to see. The API answers both with a 404
 * rather than confirming it exists, so this cannot tell them apart either.
 */
export function DetailMissing({ what, reason }: { what: string; reason: string }) {
  const canvas = usePosterCanvas();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.xl,
        backgroundColor: canvas.background,
      }}
    >
      <Icon
        name={{ sf: 'questionmark.circle', md: 'help-outline' }}
        size={30}
        color={canvas.soft}
      />
      <PosterText variant="title" color={canvas.ink}>
        {`${what} not found`}
      </PosterText>
      <PosterText variant="body" color={canvas.soft} style={{ textAlign: 'center' }}>
        {reason}
      </PosterText>
      <Pressable
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => router.back()}
        style={({ pressed }) => ({ padding: spacing.sm, opacity: pressed ? 0.6 : 1 })}
      >
        <PosterText variant="rowTitle" color={canvas.ink}>
          Go back
        </PosterText>
      </Pressable>
    </View>
  );
}

/** "Edit" in the bar, set like the spoke screens' header action. */
export function HeaderEdit({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress}>
      <PosterText variant="rowTitle" color={colors.primary}>
        Edit
      </PosterText>
    </Pressable>
  );
}
