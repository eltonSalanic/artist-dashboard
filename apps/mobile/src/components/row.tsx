import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { radius, spacing, useTokens } from '@/theme';
import { ThemedText } from './themed-text';

/**
 * A list row: something small on the left, a title, a quieter line under it,
 * and something small on the right.
 *
 * Grouped rows separated by hairlines rather than a card each — "Everything's a
 * Card", every row in its own rounded shadowed box, is one of the named
 * native-slop tells, and a list of twelve tasks is exactly where it shows up.
 */
export function Row({
  title,
  meta,
  lead,
  trailing,
  dim = false,
  first = false,
  onPress,
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
}) {
  const tokens = useTokens();

  const body = (
    <>
      {lead !== undefined && <View style={{ width: 18, alignItems: 'center' }}>{lead}</View>}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText
          variant="body"
          numberOfLines={2}
          style={dim ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
        >
          {title}
        </ThemedText>
        {meta != null && meta !== '' && (
          <ThemedText variant="footnote" tone="muted" numberOfLines={1}>
            {meta}
          </ThemedText>
        )}
      </View>
      {typeof trailing === 'string' ? (
        <ThemedText variant="footnote" tone="muted">
          {trailing}
        </ThemedText>
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

  if (!onPress) return <View style={layout}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        layout,
        pressed && { backgroundColor: tokens.accent },
      ]}
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
