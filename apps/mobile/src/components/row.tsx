import type { ReactNode } from 'react';
import { Pressable, View, type AccessibilityActionInfo } from 'react-native';
import { radius, spacing, useTokens } from '@/theme';
import { PosterText } from './poster-text';

/**
 * A list row: something small on the left, a title, a quieter line under it,
 * and something small on the right.
 *
 * Grouped rows separated by hairlines rather than a card each — "Everything's a
 * Card", every row in its own rounded shadowed box, is one of the named
 * native-slop tells, and a list of twelve tasks is exactly where it shows up.
 *
 * Set like a Spotify track row: a semibold title, a medium-weight grey line.
 */
export function Row({
  title,
  meta,
  lead,
  trailing,
  dim = false,
  first = false,
  onPress,
  onLongPress,
  accessibilityActions,
  onAccessibilityAction,
}: {
  title: string;
  meta?: string | null;
  lead?: ReactNode;
  trailing?: ReactNode;
  /** Completed or done: still legible, visibly finished. */
  dim?: boolean;
  /** Suppresses the separator, so a list has no rule above its first row. */
  first?: boolean;
  onPress?: () => void;
  /** Press-and-hold — a reorderable list uses it to pick the row up. */
  onLongPress?: () => void;
  /** Named actions a screen reader offers instead of a gesture it cannot do. */
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (actionName: string) => void;
}) {
  const tokens = useTokens();

  const body = (
    <>
      {lead !== undefined && <View style={{ width: 18, alignItems: 'center' }}>{lead}</View>}
      <View style={{ flex: 1, gap: 2 }}>
        <PosterText
          variant="rowTitle"
          color={tokens.foreground}
          numberOfLines={2}
          style={dim ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
        >
          {title}
        </PosterText>
        {meta != null && meta !== '' && (
          <PosterText variant="cardMeta" color={tokens.mutedForeground} numberOfLines={1}>
            {meta}
          </PosterText>
        )}
      </View>
      {typeof trailing === 'string' ? (
        <PosterText variant="cardMeta" color={tokens.mutedForeground}>
          {trailing}
        </PosterText>
      ) : (
        trailing
      )}
    </>
  );

  const layout = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderTopWidth: first ? 0 : 1,
    borderTopColor: tokens.border,
    borderRadius: radius.sm,
    borderCurve: 'continuous' as const,
    // 44pt is the smallest comfortable touch target; rows grow past it when
    // the text does, which is what lets Dynamic Type work here.
    minHeight: 48,
  };

  if (!onPress && !onLongPress) return <View style={layout}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={
        onAccessibilityAction
          ? (event) => onAccessibilityAction(event.nativeEvent.actionName)
          : undefined
      }
      style={({ pressed }) => [layout, pressed && { backgroundColor: tokens.accent }]}
    >
      {body}
    </Pressable>
  );
}

/** A status or type colour, as a dot. Colour never carries meaning alone — the
 *  row's text always says the same thing in words. */
export function Dot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: color,
      }}
    />
  );
}
