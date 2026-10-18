import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { posterRadius, spacing, type WidgetInk } from '@/theme';
import { Icon } from './icon';
import { PosterText } from './poster-text';

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
