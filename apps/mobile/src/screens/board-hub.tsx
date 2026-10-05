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
  useAnimatedRef,
  useAnimatedScrollHandler,
  useScrollOffset,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useBoard, useResetMobileLayout, useSaveMobileLayout } from '@artist/api-client';
import { WIDGET_META, resolveBoardTheme, type MobileLayoutItem } from '@artist/shared';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { HubCardSkeleton } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { HubGrid, ROW_HEIGHT } from '@/features/board/hub-grid';
import { useOnHubEditRequest } from '@/features/board/hub-edit';
import { useSelectedBoard } from '@/features/board/selected-board';
import { useHubCards } from '@/features/board/use-hub-cards';
import { HeaderText } from '@/features/forms/form-screen';
import { useRefetchOnFocus } from '@/lib/refetch-on-focus';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * The board hub. One board's widgets as summaries; tapping one opens its spoke
 * (P8). There is no tab strip here on purpose — a ten-item horizontal scroller
 * is a poor index, because you cannot see what is available, you discover it by
 * scrolling blind. The card grid shows every widget with its numbers, which is
 * a better index than tabs could be.
 *
 * Holding a card (or ⋯ → Edit widgets) puts the hub in edit mode (P12b): move,
 * resize and hide cards in place, then Done saves the phone's arrangement.
 */
export function BoardHubScreen() {
  const colors = useThemeColors();
  const { board, boards, loading } = useSelectedBoard();

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
          <ThemedText variant="title">No band yet</ThemedText>
          <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
            Signing in normally creates your first board. Ask an admin to invite you, or start one
            on the web.
          </ThemedText>
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

/**
 * Mounted only once a board exists, so none of the nine widget queries fire
 * against a `/boards//...` URL while the selection is still resolving.
 */
function BoardHub({ boardId, name }: { boardId: string; name: string }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  useRefetchOnFocus();
  const detail = useBoard(boardId);
  const hub = useHubCards(boardId, resolveBoardTheme(detail.data?.theme));
  const save = useSaveMobileLayout(boardId);
  const reset = useResetMobileLayout(boardId);

  // The arrangement being edited; null when not editing.
  const [draft, setDraft] = useState<MobileLayoutItem[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const editing = draft !== null;
  const items = draft ?? hub.items;
  const dirty = draft !== null && signature(draft) !== signature(hub.items);
  const shown = items.filter((item) => !item.hidden).length;

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

  const done = () => {
    if (!dirty || draft === null) return setDraft(null);
    // Saves keep the draft until they land: a failed save leaves you editing.
    save.mutate(draft, { onSuccess: () => setDraft(null) });
  };

  const cancel = () => {
    if (!dirty) return setDraft(null);
    Alert.alert('Discard changes?', 'Your cards go back to how they were.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setDraft(null) },
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
          onPress: () => reset.mutate(undefined, { onSuccess: () => setDraft(null) }),
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
          {hub.error.message}
        </ThemedText>
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
          {editing && (
            <Animated.View
              entering={APPEAR}
              exiting={VANISH}
              layout={SLIDE}
              style={{ gap: spacing.sm }}
            >
              <ThemedText variant="footnote" tone="muted">
                Hold a card to move it. Drag its corner to resize it, or tap its eye to hide it.
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

      {/* The board name *is* the switcher. Tapping a title to change context is
          the Slack/Notion/Linear convention and needs no teaching. While
          editing, the header becomes Cancel and Done, as in a form. */}
      <Stack.Screen
        options={{
          headerTitle: () => <BoardTitle name={name} />,
          headerLeft: editing ? () => <HeaderText title="Cancel" onPress={cancel} /> : undefined,
          headerRight: editing
            ? () => (
                <HeaderText
                  title="Done"
                  bold
                  disabled={save.isPending || shown === 0}
                  onPress={done}
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

function BoardMenuButton() {
  const colors = useThemeColors();
  return (
    <Link href="/board-menu" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Board options"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Icon name={{ sf: 'ellipsis', md: 'more-horiz' }} size={20} color={colors.primary} />
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
