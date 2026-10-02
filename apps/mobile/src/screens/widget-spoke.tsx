import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { Stack } from 'expo-router';
import { WIDGET_META, type WidgetType } from '@artist/shared';
import { ThemedText } from '@/components/themed-text';
import { SPOKES } from '@/features/board/spoke-registry';
import { useVisibleWidgets } from '@/features/board/use-visible-widgets';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * One widget, expanded — and swipeable to the ones either side.
 *
 * The lateral strip lives **here**, not on the hub. On the hub it would be a
 * ten-item scroller you discover by scrolling blind; once you have context,
 * moving sideways is useful and the strip tells you where you are. Photos'
 * grid → tap → swipe, which is the pattern people already know.
 */
export function WidgetSpokeScreen({
  boardId,
  widgetType,
}: {
  boardId: string;
  widgetType: WidgetType;
}) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const { widgets } = useVisibleWidgets(boardId);

  // Fall back to the one widget that was asked for: a deep link can land here
  // before the layout has loaded, and paging through an empty list is worse
  // than paging through a list of one.
  const pages = widgets.length > 0 ? widgets : [widgetType];
  const initial = Math.max(0, pages.indexOf(widgetType));
  const [index, setIndex] = useState(initial);
  const listRef = useRef<FlatList<WidgetType>>(null);

  const onViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]?.index;
      if (typeof first === 'number') setIndex(first);
    },
    [],
  );

  const goTo = (next: number) => {
    setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {pages.length > 1 && (
        <PositionStrip pages={pages} index={index} onSelect={goTo} />
      )}

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(type) => type}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initial}
        // Full-width pages, so the layout is known without measuring — which is
        // what makes `initialScrollIndex` land on the right widget rather than
        // scrolling there after the fact.
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => {
          const Spoke = SPOKES[item];
          return (
            <View style={{ width }}>
              {Spoke ? (
                <Spoke boardId={boardId} />
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: spacing.xl,
                  }}
                >
                  {/* A layout entry for a widget this build does not ship.
                      The hub skips these; here it means a deep link named one. */}
                  <ThemedText variant="subhead" tone="muted">
                    This widget is not available on mobile yet.
                  </ThemedText>
                </View>
              )}
            </View>
          );
        }}
      />

      <Stack.Screen
        options={{
          title: WIDGET_META[pages[index] ?? widgetType].title,
          headerBackTitle: 'Board',
        }}
      />
    </View>
  );
}

/**
 * Which widget you are on, and the ones either side. Labels rather than dots:
 * ten dots say how far along you are but not what you would land on.
 */
function PositionStrip({
  pages,
  index,
  onSelect,
}: {
  pages: WidgetType[];
  index: number;
  onSelect: (next: number) => void;
}) {
  const colors = useThemeColors();

  const stripRef = useRef<FlatList<WidgetType>>(null);

  // Keep the active chip on screen. Ten widgets overflow the strip, so without
  // this, swiping to the eighth leaves the strip showing the first four and the
  // position indicator stops indicating anything.
  useEffect(() => {
    stripRef.current?.scrollToIndex({
      index,
      animated: true,
      viewPosition: 0.5,
    });
  }, [index]);

  return (
    <FlatList
      ref={stripRef}
      data={pages}
      keyExtractor={(type) => type}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: spacing.xs,
      }}
      // Chips are text-width, so there is no layout to precompute; a scroll
      // before measurement just does nothing rather than throwing.
      onScrollToIndexFailed={() => undefined}
      renderItem={({ item: type, index: i }) => {
        const active = i === index;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(i)}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.sm + 2,
              paddingVertical: spacing.xs + 2,
              borderRadius: radius.full,
              backgroundColor: active ? colors.primary : colors.muted,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <ThemedText
              variant="footnote"
              style={{
                color: active ? colors.primaryForeground : colors.mutedForeground,
                fontWeight: '600',
              }}
            >
              {WIDGET_META[type].title}
            </ThemedText>
          </Pressable>
        );
      }}
    />
  );
}
