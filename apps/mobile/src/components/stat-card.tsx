import { Pressable, View } from 'react-native';
import { ThemeTokensProvider, radius, shadows, spacing, useSlotTokens } from '@/theme';
import type { HubCard } from '@/features/board/use-hub-cards';
import { Icon } from './icon';
import { Skeleton } from './skeleton';
import { ThemedText } from './themed-text';

/**
 * One widget as a summary. The anatomy is fixed — icon + title, one value, one
 * qualifier — because ten cards that each decide their own shape stop reading
 * as a grid and start reading as a list of unrelated boxes.
 *
 * `hero` spans the width and shows prose; `stat` sits two-up and shows a
 * number. Two prose cards among eight numbers is what gives the grid a rhythm
 * instead of a uniform wall of digits.
 */
export function HubStatCard({
  card,
  onPress,
}: {
  card: HubCard;
  onPress?: () => void;
}) {
  const tokens = useSlotTokens(card.slot);
  const hero = card.kind === 'hero';

  return (
    <ThemeTokensProvider value={tokens}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          card.primary
            ? `${card.title}: ${card.primary}${card.qualifier ? `, ${card.qualifier}` : ''}`
            : `${card.title}: nothing yet`
        }
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: tokens.card,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          padding: spacing.md,
          gap: spacing.xs,
          boxShadow: shadows.card,
          minHeight: hero ? 96 : 112,
          justifyContent: 'space-between',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name={card.icon} size={15} color={tokens.mutedForeground} />
          <ThemedText variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
            {card.title.toUpperCase()}
          </ThemedText>
          {card.urgent && (
            <View
              accessibilityLabel="Needs attention"
              style={{
                width: 7,
                height: 7,
                borderRadius: radius.full,
                backgroundColor: tokens.destructive,
              }}
            />
          )}
        </View>

        {card.loading ? (
          <View style={{ gap: spacing.xs }}>
            <Skeleton width="55%" height={hero ? 18 : 28} />
            <Skeleton width="35%" height={12} />
          </View>
        ) : card.primary === null ? (
          <ThemedText variant="subhead" tone="muted">
            Nothing yet
          </ThemedText>
        ) : (
          <View style={{ gap: 2 }}>
            <ThemedText
              variant={hero ? 'body' : 'largeTitle'}
              numberOfLines={hero ? 3 : 1}
            >
              {card.primary}
            </ThemedText>
            {card.qualifier !== null && (
              <ThemedText variant="footnote" tone="muted" numberOfLines={1}>
                {card.qualifier}
              </ThemedText>
            )}
          </View>
        )}
      </Pressable>
    </ThemeTokensProvider>
  );
}

/**
 * The grid before the layout has arrived. Separate from `HubStatCard` because
 * feeding it a stand-in card meant inventing a widget type and a blank title
 * just to reach its loading branch.
 */
export function HubCardSkeleton() {
  const tokens = useSlotTokens('base');
  return (
    <View
      style={{
        backgroundColor: tokens.card,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        padding: spacing.md,
        gap: spacing.sm,
        boxShadow: shadows.card,
        minHeight: 112,
        justifyContent: 'space-between',
      }}
    >
      <Skeleton width="45%" height={10} />
      <View style={{ gap: spacing.xs }}>
        <Skeleton width="55%" height={28} />
        <Skeleton width="35%" height={12} />
      </View>
    </View>
  );
}
