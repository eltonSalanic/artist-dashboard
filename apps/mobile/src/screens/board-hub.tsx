import { useCallback, useRef, useState } from 'react';
import { Link, Stack, router } from 'expo-router';
import { Alert, Pressable, RefreshControl, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useScrollOffset,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import {
  toUserMessage,
  useBoard,
  useMySubscription,
  usePermissions,
  useResetMobileLayout,
  useSaveBoardTheme,
  useSaveMobileLayout,
} from '@artist/api-client';
import {
  WIDGET_META,
  resolveBoardTheme,
  type BoardTheme,
  type MobileLayoutItem,
} from '@artist/shared';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { HubCardSkeleton } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { HubGrid, ROW_HEIGHT } from '@/features/board/hub-grid';
import { useOnHubEditRequest } from '@/features/board/hub-edit';
import { useSelectedBoard } from '@/features/board/selected-board';
import { useHubCards } from '@/features/board/use-hub-cards';
import { HeaderText } from '@/features/forms/form-screen';
import { useRefetchOnFocus } from '@/lib/refetch-on-focus';
import { SubscriptionScreen } from '@/screens/subscription';
import { radius, spacing, usePosterCanvas, useThemeColors } from '@/theme';

/**
 * The board hub. One board's widgets as summaries; tapping one opens its spoke
 * (P8). There is no tab strip here on purpose — a ten-item horizontal scroller
 * is a poor index, because you cannot see what is available, you discover it by
 * scrolling blind. The card grid shows every widget with its numbers, which is
 * a better index than tabs could be.
 *
 * Holding a card (or ⋯ → Edit widgets) puts the hub in edit mode (P12b): move,
 * resize and hide cards in place, then Done saves the phone's arrangement.
 * Someone allowed to change the band's look can recolour cards there too;
 * colours are the band's, so Done saves those for everyone, web included.
 */
export function BoardHubScreen() {
  const colors = useThemeColors();
  const { board, boards, loading } = useSelectedBoard();
  const mine = useMySubscription();

  // With billing enforced, an unpaid band's routes all answer 402: it lands on
  // the subscription screen instead of a wall of failed cards. Someone in several bands can
  // still switch to another.
  if (board?.subscriptionRequired) {
    return (
      <SubscriptionScreen
        key={board.id}
        boardId={board.id}
        // Inside the scroll view, so the floating tab bar never covers it.
        footer={
          boards.length > 1 ? (
            <Button title="Switch band" variant="secondary" onPress={() => router.push('/boards')} />
          ) : null
        }
      />
    );
  }

  // Keyed by board, so an edit in progress never carries over to another band.
  if (board !== null) return <BoardHub key={board.id} boardId={board.id} name={board.name} />;

  return (
    <>
      {!loading && boards.length === 0 && (
        <View style={styles.centered(colors.background)}>
          <Icon
            name={{ sf: 'music.note.house', md: 'home-work' }}
            size={36}
            color={colors.mutedForeground}
          />
          <ThemedText variant="title" style={{ textAlign: 'center' }}>
            You haven&apos;t joined any bands yet
          </ThemedText>
          <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
            Join or create one. To join, ask one of the band&apos;s admins to invite you.
          </ThemedText>
          <Button
            title="Create A Band"
            // No subscription yet: straight to it, rather than through a sheet
            // holding a second "Create a band".
            onPress={() =>
              router.push(
                mine.data?.createBlock === 'NO_SUBSCRIPTION' ? '/subscribe' : '/boards?create=1',
              )
            }
          />
        </View>
      )}
      <Stack.Screen
        options={{
          headerTitle: () => <BoardTitle name="Board" />,
          headerRight: () => <BoardMenuButton />,
        }}
      />
    </>
  );
}

/**
 * Entering and leaving edit mode adds and removes a hint, the hidden cards and
 * a button around the grid. They fade, and everything they push slides, so
 * the hub changes into edit mode rather than cutting to it.
 */
const SLIDE = LinearTransition.duration(300)
  .easing(Easing.bezier(0.77, 0, 0.175, 1))
  .reduceMotion(ReduceMotion.System);
const APPEAR = FadeIn.duration(200).reduceMotion(ReduceMotion.System);
const VANISH = FadeOut.duration(150).reduceMotion(ReduceMotion.System);

/** Roughly the tab bar's height above the home indicator. */
const TAB_BAR = 49;

const signature = (items: MobileLayoutItem[]) =>
  items.map((i) => `${i.widgetType}:${i.w}x${i.h}:${i.hidden ? 0 : 1}`).join();

const colourSignature = (widgets: BoardTheme['widgets']) =>
  Object.entries(widgets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, color]) => `${type}:${color}`)
    .join();

/**
 * Mounted only once a board exists, so none of the nine widget queries fire
 * against a `/boards//...` URL while the selection is still resolving.
 */
function BoardHub({ boardId, name }: { boardId: string; name: string }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  useRefetchOnFocus();
  const { can } = usePermissions();
  const detail = useBoard(boardId);
  const saved = resolveBoardTheme(detail.data?.theme);
  // Colours picked in edit mode, painted at once but saved only with Done.
  const [colours, setColours] = useState<BoardTheme['widgets'] | null>(null);
  const theme = colours ? { ...saved, widgets: colours } : saved;
  const hub = useHubCards(boardId, theme);
  const save = useSaveMobileLayout(boardId);
  const saveTheme = useSaveBoardTheme(boardId);
  const reset = useResetMobileLayout(boardId);

  // The arrangement being edited; null when not editing.
  const [draft, setDraft] = useState<MobileLayoutItem[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const editing = draft !== null;
  const items = draft ?? hub.items;
  const layoutDirty = draft !== null && signature(draft) !== signature(hub.items);
  const coloursDirty =
    colours !== null && colourSignature(colours) !== colourSignature(saved.widgets);
  const dirty = layoutDirty || coloursDirty;
  const shown = items.filter((item) => !item.hidden).length;

  const stopEditing = () => {
    setDraft(null);
    setColours(null);
  };

  const startEditing = useCallback(() => {
    if (hub.loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDraft((current) => current ?? hub.items);
  }, [hub.loading, hub.items]);

  useOnHubEditRequest(startEditing);

  const change = useCallback(
    (update: (list: MobileLayoutItem[]) => MobileLayoutItem[]) =>
      setDraft((current) => (current === null ? current : update(current))),
    [],
  );

  const done = async () => {
    if (!dirty || draft === null) return stopEditing();
    // Saves keep the draft until they land: a failed save leaves you editing.
    // Each mutation reports its own failure, so there is nothing to add here.
    try {
      await Promise.all([
        layoutDirty ? save.mutateAsync(draft) : null,
        coloursDirty && colours ? saveTheme.mutateAsync({ ...saved, widgets: colours }) : null,
      ]);
      stopEditing();
    } catch {
      // Still editing, with the toast saying why.
    }
  };

  const cancel = () => {
    if (!dirty) return stopEditing();
    Alert.alert('Discard changes?', 'Your cards go back to how they were.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: stopEditing },
    ]);
  };

  const followWeb = () =>
    Alert.alert(
      'Follow your web dashboard?',
      "Your phone's own arrangement is removed, and it shows your cards in your web dashboard's order again. Web isn't changed.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Follow web',
          style: 'destructive',
          onPress: () => reset.mutate(undefined, { onSuccess: stopEditing }),
        },
      ],
    );

  // Scroll state for dragging a card past the edge of the screen. The range
  // comes from the scroll events, since the insets the system adds for the
  // header and tab bar are only known there.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollOffset(scrollRef);
  const minOffset = useSharedValue(0);
  const maxOffset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    minOffset.set(-event.contentInset.top);
    maxOffset.set(
      Math.max(
        -event.contentInset.top,
        event.contentSize.height - event.layoutMeasurement.height + event.contentInset.bottom,
      ),
    );
  });
  // The visible band of the screen, in the window coordinates a drag reports.
  // The tab bar floats over the bottom of the hub, so it is taken off.
  const frameRef = useRef<View>(null);
  const viewTop = useSharedValue(0);
  const viewBottom = useSharedValue(0);
  const measureViewport = () =>
    frameRef.current?.measureInWindow((_x, y, _width, height) => {
      viewTop.set(Math.max(y, insets.top));
      viewBottom.set(y + height - insets.bottom - TAB_BAR);
    });

  if (hub.error) {
    return (
      <View style={styles.centered(colors.background)}>
        <ThemedText variant="headline" tone="destructive">
          Could not load this board
        </ThemedText>
        <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
          {toUserMessage(hub.error)}
        </ThemedText>
        <Button
          title="Try again"
          variant="ghost"
          size="sm"
          onPress={() => void queryClient.refetchQueries({ type: 'active' })}
        />
      </View>
    );
  }

  const hidden = items.filter((item) => item.hidden);

  return (
    <>
      <View ref={frameRef} style={{ flex: 1 }} onLayout={measureViewport}>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!dragging}
          onContentSizeChange={(_, height) => {
            // Until the first scroll event, assume no system insets.
            if (maxOffset.get() === 0)
              maxOffset.set(Math.max(0, height - viewBottom.get() + viewTop.get()));
          }}
          style={{ flex: 1, backgroundColor: colors.background }}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
          refreshControl={
            // Always mounted, even while editing. On iOS the control is the
            // scroll view's first child, so removing it shifts the content to
            // a new slot and React rebuilds every card: edit mode flashed in,
            // and nothing could animate. Editing just switches it off.
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                if (editing) return;
                // Pull-to-refresh is the gesture people already try on a phone;
                // invalidating the board's whole subtree is cheaper to reason
                // about than listing nine keys that must stay in sync with the hook.
                void queryClient.invalidateQueries();
              }}
              tintColor={editing ? 'transparent' : colors.mutedForeground}
            />
          }
        >
          <Animated.View layout={SLIDE}>
            <Masthead name={name} />
          </Animated.View>

          {hub.loading ? (
            // The arrangement decides how many cards there are, so until it
            // lands the count is a guess. Six keeps the screen from jumping much.
            <View style={styles.skeletons}>
              {Array.from({ length: 6 }, (_, index) => (
                <View key={index} style={styles.skeleton}>
                  <HubCardSkeleton />
                </View>
              ))}
            </View>
          ) : (
            <Animated.View layout={SLIDE}>
              <HubGrid
                cards={hub.cards}
                items={items}
                editing={editing}
                recolour={
                  can('board.appearance')
                    ? {
                        palette: theme.palette,
                        onPick: (type, color) =>
                          setColours((current) => ({
                            ...(current ?? saved.widgets),
                            [type]: color,
                          })),
                      }
                    : undefined
                }
                scroll={{
                  ref: scrollRef,
                  offset,
                  min: minOffset,
                  max: maxOffset,
                  top: viewTop,
                  bottom: viewBottom,
                }}
                onOpen={(type) => router.push(`/board/${boardId}/w/${type}`)}
                onStartEditing={startEditing}
                onChange={change}
                onDragging={setDragging}
              />
            </Animated.View>
          )}

          {/* Edit-only content stays below the grid so a hold never shifts
              the cards or changes the held card's reorder target. */}
          {editing && (
            <Animated.View
              entering={APPEAR}
              exiting={VANISH}
              layout={SLIDE}
              style={{ gap: spacing.sm }}
            >
              <ThemedText variant="footnote" tone="muted">
                Hold a card to move it. Drag its corner to resize it, or tap its eye to hide it.
                {can('board.appearance')
                  ? " Its palette changes the card's colour for the whole band, on web too."
                  : ''}
                {hub.source === 'web'
                  ? ' Your phone follows your web dashboard until you save here; web stays as it is.'
                  : " This is your phone's own arrangement; it doesn't change web."}
              </ThemedText>
              {hidden.length > 0 && (
                <Animated.View layout={SLIDE} style={styles.chips}>
                  <ThemedText variant="caption" tone="muted">
                    HIDDEN
                  </ThemedText>
                  {hidden.map((item) => (
                    <Animated.View
                      key={item.widgetType}
                      entering={APPEAR}
                      exiting={VANISH}
                      layout={SLIDE}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Show ${WIDGET_META[item.widgetType].title}`}
                        onPress={() =>
                          change((list) =>
                            list.map((i) =>
                              i.widgetType === item.widgetType ? { ...i, hidden: false } : i,
                            ),
                          )
                        }
                        style={({ pressed }) => ({
                          ...styles.chip,
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <ThemedText variant="footnote">
                          {WIDGET_META[item.widgetType].title}
                        </ThemedText>
                        <Icon
                          name={{ sf: 'eye', md: 'visibility' }}
                          size={13}
                          color={colors.primary}
                        />
                      </Pressable>
                    </Animated.View>
                  ))}
                </Animated.View>
              )}
            </Animated.View>
          )}

          {editing && hub.source === 'phone' && (
            <Animated.View entering={APPEAR} exiting={VANISH} layout={SLIDE}>
              <Button
                title="Follow my web dashboard"
                variant="secondary"
                loading={reset.isPending}
                onPress={followWeb}
              />
            </Animated.View>
          )}
        </Animated.ScrollView>
      </View>

      {/* The band's name is set huge at the top of the page (the masthead), so
          the header only names it once that has scrolled away. While editing,
          the header becomes Cancel and Done, as in a form. */}
      <Stack.Screen
        options={{
          headerTitle: () => <FadingTitle name={name} offset={offset} min={minOffset} />,
          headerLeft: editing ? () => <HeaderText title="Cancel" onPress={cancel} /> : undefined,
          headerRight: editing
            ? () => (
                <HeaderText
                  title="Done"
                  bold
                  disabled={save.isPending || saveTheme.isPending || shown === 0}
                  onPress={() => void done()}
                />
              )
            : () => <BoardMenuButton />,
        }}
      />
    </>
  );
}

function BoardTitle({ name }: { name: string }) {
  const colors = useThemeColors();
  return (
    <Link href="/boards" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. Change band`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ThemedText variant="headline" numberOfLines={1}>
          {name}
        </ThemedText>
        <Icon
          name={{ sf: 'chevron.down', md: 'expand-more' }}
          size={14}
          color={colors.mutedForeground}
        />
      </Pressable>
    </Link>
  );
}

/**
 * Today's date in small caps, then the band's name as big as it will go, with
 * a round button that says it opens something. The name *is* the switcher:
 * tapping a title to change context is the Slack/Notion/Linear convention and
 * needs no teaching; here it is simply a much bigger title.
 */
function Masthead({ name }: { name: string }) {
  const canvas = usePosterCanvas();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return (
    <Link href="/boards" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. Change band`}
        style={({ pressed }) => ({ gap: 2, opacity: pressed ? 0.6 : 1 })}
      >
        <PosterText variant="label" color={canvas.soft}>
          {today.toUpperCase()}
        </PosterText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <PosterText
            variant="display"
            color={canvas.ink}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={{ flexShrink: 1 }}
          >
            {name}
          </PosterText>
          <View
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: canvas.ink,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
            }}
          >
            <Icon
              name={{ sf: 'chevron.down', md: 'expand-more' }}
              size={14}
              color={canvas.background}
            />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/**
 * The band's name in the header, faded in once the masthead has scrolled
 * under it, so the switcher is never out of reach. Only reads shared values
 * and calls `interpolate` on the UI thread.
 */
function FadingTitle({
  name,
  offset,
  min,
}: {
  name: string;
  offset: SharedValue<number>;
  min: SharedValue<number>;
}) {
  const canvas = usePosterCanvas();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get() - min.get(), [40, 90], [0, 1], 'clamp'),
  }));
  return (
    <Animated.View style={style}>
      <Link href="/boards" asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}. Change band`}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 }}
        >
          <PosterText variant="caption" color={canvas.ink} numberOfLines={1}>
            {name}
          </PosterText>
          <Icon name={{ sf: 'chevron.down', md: 'expand-more' }} size={12} color={canvas.soft} />
        </Pressable>
      </Link>
    </Animated.View>
  );
}

/** The board menu, as an outlined circle to match the masthead's button. */
function BoardMenuButton() {
  const canvas = usePosterCanvas();
  return (
    <Link href="/board-menu" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Board options"
        hitSlop={8}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: canvas.ink,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon name={{ sf: 'ellipsis', md: 'more-horiz' }} size={18} color={canvas.ink} />
      </Pressable>
    </Link>
  );
}

const styles = {
  chips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  skeletons: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    rowGap: spacing.sm,
  },
  /** Loading placeholders: two up, one row tall, before the arrangement is known. */
  skeleton: { width: '48.5%' as const, height: ROW_HEIGHT },
  centered: (background: string) => ({
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: background,
  }),
};
