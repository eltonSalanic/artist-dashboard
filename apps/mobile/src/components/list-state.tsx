import { View } from 'react-native';
import { Button } from './button';
import { Icon, type IconName } from './icon';
import { Skeleton } from './skeleton';
import { ThemedText } from './themed-text';
import { spacing, useTokens } from '@/theme';

/**
 * Loading, failed and empty, for a list that owns its own `FlatList`.
 *
 * `SpokeList` next door says the same three things, but it owns a `ScrollView`,
 * and a virtualised list cannot live inside one. The screens that need
 * virtualisation — the feed, the agenda, the inbox — pass this as their
 * `ListEmptyComponent` instead, so the three states read identically whichever
 * kind of list is underneath.
 *
 * Empty means *resolved with nothing in it*: a designed state that says why and
 * what to do, not a blank area.
 */
export function ListState({
  pending,
  error,
  onRetry,
  icon,
  title,
  body,
}: {
  pending: boolean;
  error?: Error | null;
  onRetry?: () => void;
  icon: IconName;
  title: string;
  body?: string;
}) {
  const tokens = useTokens();

  if (pending) {
    return (
      <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ gap: spacing.xs }}>
            <Skeleton width="75%" height={16} />
            <Skeleton width="40%" height={11} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xl,
      }}
    >
      <Icon
        name={error ? { sf: 'exclamationmark.triangle', md: 'warning' } : icon}
        size={28}
        color={tokens.mutedForeground}
      />
      <ThemedText variant="headline">
        {error ? 'Could not load this' : title}
      </ThemedText>
      {(error?.message ?? body) !== undefined && (
        <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
          {error ? error.message : body}
        </ThemedText>
      )}
      {error && onRetry && (
        <Button title="Try again" variant="ghost" size="sm" onPress={onRetry} />
      )}
    </View>
  );
}
