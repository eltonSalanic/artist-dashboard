import { Pressable, View } from 'react-native';
import { ThemeTokensProvider, radius, shadows, spacing, useSlotTokens } from '@/theme';
import type { HubCard } from '@/features/board/use-hub-cards';
import { Icon } from './icon';
import { PosterText } from './poster-text';
import { Skeleton } from './skeleton';

/** How long a card is held before the hub goes into edit mode. */
export const HOLD_TO_EDIT = 400;

/**
 * One widget as a summary. The anatomy is fixed — icon + title, one value, one
 * qualifier — because ten cards that each decide their own shape stop reading
 * as a grid and start reading as a list of unrelated boxes.
 *
 * `hero` shows prose, `stat` a number. A card two rows `tall` adds the first
 * few things behind the number (the next shows, the top tasks), the way a
 * large phone widget does. The grid sizes the card; it fills its cell.
 *
 * Set in Figtree, the Spotify-like face the redesign uses: heavy small caps
 * for the name, Black for the number. Colours still come from the card's
 * own token set, so it reads on every palette slot.
 */
export function HubStatCard({
  card,
  tall = false,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
}: {
  card: HubCard;
  tall?: boolean;
  onPress?: () => void;
  /** Holding a card is how the hub enters edit mode. */
  onLongPress?: () => void;
  /** So the grid can shrink the card while it is held, as a phone's home screen does. */
  onPressIn?: () => void;
  onPressOut?: () => void;
}) {
  const tokens = useSlotTokens(card.slot);
  const hero = card.kind === 'hero';
  const lines = tall && !card.loading ? card.lines : [];

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
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        delayLongPress={HOLD_TO_EDIT}
        style={({ pressed }) => ({
          flex: 1,
          overflow: 'hidden',
          backgroundColor: tokens.card,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          padding: spacing.md,
          gap: spacing.xs,
          boxShadow: shadows.card,
          justifyContent: tall ? 'flex-start' : 'space-between',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name={card.icon} size={15} color={tokens.mutedForeground} />
          <PosterText
            variant="label"
            color={tokens.mutedForeground}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {card.title.toUpperCase()}
          </PosterText>
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
          <PosterText variant="body" color={tokens.mutedForeground}>
            Nothing yet
          </PosterText>
        ) : (
          <View style={{ gap: 2 }}>
            <PosterText
              variant={hero ? 'prose' : 'stat'}
              color={tokens.foreground}
              numberOfLines={hero ? (tall ? 4 : 3) : 1}
              adjustsFontSizeToFit={!hero}
              minimumFontScale={0.6}
            >
              {card.primary}
            </PosterText>
            {card.qualifier !== null && (
              <PosterText variant="meta" color={tokens.mutedForeground} numberOfLines={1}>
                {card.qualifier}
              </PosterText>
            )}
          </View>
        )}

        {lines.length > 0 && (
          <View style={{ gap: 2, marginTop: spacing.xs }}>
            {lines.map((line) => (
              <View key={line.key} style={{ flexDirection: 'row', gap: spacing.xs }}>
                <PosterText
                  variant="meta"
                  color={tokens.foreground}
                  numberOfLines={1}
                  style={{ flex: 1 }}
                >
                  {line.text}
                </PosterText>
                {line.meta !== null && (
                  <PosterText variant="meta" color={tokens.mutedForeground} numberOfLines={1}>
                    {line.meta}
                  </PosterText>
                )}
              </View>
            ))}
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
        flex: 1,
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
