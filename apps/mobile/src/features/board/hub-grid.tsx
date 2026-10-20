import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ReduceMotion,
  scrollTo,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  moveCard,
  packMobileGrid,
  resizeCard,
  WidgetColors,
  slotLabel,
  stretchLoneCards,
  type BoardPalette,
  type CardWidgetType,
  type MobileLayoutItem,
  type MobilePlacement,
  type MobileSpan,
  type WidgetColor,
} from '@artist/shared';
import { Icon, type IconName } from '@/components/icon';
import { HOLD_TO_EDIT, HubStatCard } from '@/components/stat-card';
import { cardTokens, radius, spacing, useScheme, useShadows, useThemeColors } from '@/theme';
import type { HubCard } from './use-hub-cards';

/**
 * The hub as a two-column grid of cards, each 1 or 2 cells wide and tall, and
 * its edit mode (P12b): hold a card and drag it to a new place, drag its
 * corner to resize it, tap its eye to hide it. The same controls web's
 * dashboard has, on a grid a phone can hold.
 *
 * Cards are placed by `packMobileGrid` from the arrangement's *order*, so a
 * drag is a reorder: crossing another card moves the dragged one to its place
 * in the list, everything re-flows, and the other cards spring to their new
 * cells. Only the crossing goes back to React; the card under the finger, the
 * springs and the auto-scroll all run on the UI thread.
 *
 * Someone allowed to change the band's look also gets a palette in each card's
 * other corner, which opens the palette's colours on the card itself.
 */

/** One row of cards: room for a number and a line under it. */
export const ROW_HEIGHT = 112;
const GAP = spacing.sm;
/** Repositioning after a drag carries the finger's momentum. */
const SNAP = {
  duration: 400,
  dampingRatio: 0.8,
  reduceMotion: ReduceMotion.System,
} as const;
/** Cards making room for a dragged one have no momentum of their own. */
const SETTLE = {
  duration: 400,
  dampingRatio: 1,
  reduceMotion: ReduceMotion.System,
} as const;
/** A card changing size or column on screen: a morph, so ease-in-out. */
const MORPH = {
  duration: 300,
  easing: Easing.bezier(0.77, 0, 0.175, 1),
  reduceMotion: ReduceMotion.System,
} as const;
/**
 * A held card sinks while it is held, so the hold reads as doing something
 * before it takes, the way a phone's home screen icon does. Ease-out: the
 * first moment of the press is the one being watched.
 */
const SINK_SCALE = 0.95;
/** In edit mode, how long a card is held before it lifts and follows the finger. */
const DRAG_HOLD = 150;

// Constants, not a helper that builds them: the drag's touch-down runs on the
// UI thread, and calling a plain function there crashes the app.
const SINK_EASE = Easing.bezier(0.23, 1, 0.32, 1);
const SINK_TO_EDIT = {
  duration: HOLD_TO_EDIT,
  easing: SINK_EASE,
  reduceMotion: ReduceMotion.System,
};
const SINK_TO_DRAG = { duration: DRAG_HOLD, easing: SINK_EASE, reduceMotion: ReduceMotion.System };

/** How far from the screen's edge a dragged card starts scrolling it, and how fast. */
const EDGE = 96;
const MAX_SCROLL_STEP = 14;

type Frame = { x: number; y: number; width: number; height: number };
type Rect = Frame & { widgetType: CardWidgetType };

export interface HubScroll {
  ref: AnimatedRef<Animated.ScrollView>;
  offset: SharedValue<number>;
  /** The scroll range, so auto-scroll stops at the ends instead of past them. */
  min: SharedValue<number>;
  max: SharedValue<number>;
  /** The visible part of the screen, in window coordinates; measured late. */
  top: SharedValue<number>;
  bottom: SharedValue<number>;
}

/** A drag in progress, shared by every card so the dragged one can be drawn. */
interface Drag {
  type: SharedValue<string>;
  startX: SharedValue<number>;
  startY: SharedValue<number>;
  width: SharedValue<number>;
  height: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  absY: SharedValue<number>;
  scrollStart: SharedValue<number>;
  /** The card last moved onto, so hovering over it does not move it again. */
  target: SharedValue<string>;
}

function span(count: number, cell: number) {
  'worklet';
  return count * cell + (count - 1) * GAP;
}

// Plain JS, scheduled from worklets: a worklet cannot capture the module.
const lift = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const tick = () => void Haptics.selectionAsync();

function frameOf(p: MobilePlacement, cell: number): Frame {
  return {
    x: p.col * (cell + GAP),
    y: p.row * (ROW_HEIGHT + GAP),
    width: span(p.w, cell),
    height: p.h * ROW_HEIGHT + (p.h - 1) * GAP,
  };
}

/** Recolouring cards, for someone allowed to: absent hides the palette. */
export interface HubRecolour {
  palette: BoardPalette;
  onPick: (widgetType: CardWidgetType, color: WidgetColor) => void;
}

export function HubGrid({
  cards,
  items,
  editing,
  scroll,
  recolour,
  onOpen,
  onStartEditing,
  onChange,
  onDragging,
}: {
  cards: Record<CardWidgetType, HubCard>;
  items: MobileLayoutItem[];
  editing: boolean;
  scroll: HubScroll;
  recolour?: HubRecolour;
  onOpen: (widgetType: CardWidgetType) => void;
  onStartEditing: () => void;
  /** Takes an update rather than a list, so a drag never acts on a stale one. */
  onChange: (update: (items: MobileLayoutItem[]) => MobileLayoutItem[]) => void;
  /** The hub stops its own scrolling while a card is being dragged. */
  onDragging: (dragging: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  const cellWidth = (width - GAP) / 2;
  // Whose colours are open. One card at a time, and none outside edit mode.
  const [picking, setPicking] = useState<CardWidgetType | null>(null);
  const openPicker = editing ? picking : null;
  const dragging = useCallback(
    (on: boolean) => {
      if (on) setPicking(null);
      onDragging(on);
    },
    [onDragging],
  );

  const { placements, rows } = useMemo(() => packMobileGrid(items), [items]);
  const frames = useMemo(
    () =>
      // While editing, cards show their true size, so what you resize is what
      // you see; otherwise a lone one-column card spans the row.
      (editing ? placements : stretchLoneCards(placements)).map((placement) => ({
        placement,
        frame: frameOf(placement, cellWidth),
      })),
    [placements, editing, cellWidth],
  );
  const height = rows > 0 ? rows * (ROW_HEIGHT + GAP) - GAP : 0;
  const shown = placements.length;

  const cell = useSharedValue(cellWidth);
  const rects = useSharedValue<Rect[]>([]);
  useEffect(() => {
    cell.set(cellWidth);
    rects.set(
      frames.map(({ placement, frame }) => ({
        ...frame,
        widgetType: placement.widgetType,
      })),
    );
  }, [cell, rects, frames, cellWidth]);

  const dragType = useSharedValue('');
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const dragWidth = useSharedValue(0);
  const dragHeight = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const absY = useSharedValue(0);
  const scrollStart = useSharedValue(0);
  const target = useSharedValue('');
  // One object for the life of the grid: the cards' gestures depend on it,
  // and a gesture rebuilt mid-drag is cancelled.
  const drag = useMemo<Drag>(
    () => ({
      type: dragType,
      startX,
      startY,
      width: dragWidth,
      height: dragHeight,
      tx,
      ty,
      absY,
      scrollStart,
      target,
    }),
    [dragType, startX, startY, dragWidth, dragHeight, tx, ty, absY, scrollStart, target],
  );

  const move = useCallback(
    (widgetType: CardWidgetType, onto: CardWidgetType) => {
      tick();
      onChange((list) => moveCard(list, widgetType, onto));
    },
    [onChange],
  );
  const resize = useCallback(
    (widgetType: CardWidgetType, w: MobileSpan, h: MobileSpan) =>
      onChange((list) => resizeCard(list, widgetType, { w, h })),
    [onChange],
  );
  const hide = useCallback(
    (widgetType: CardWidgetType) =>
      onChange((list) =>
        list.map((item) => (item.widgetType === widgetType ? { ...item, hidden: true } : item)),
      ),
    [onChange],
  );
  const step = useCallback(
    (widgetType: CardWidgetType, by: -1 | 1) =>
      onChange((list) => {
        const shownTypes = list.filter((item) => !item.hidden).map((item) => item.widgetType);
        const onto = shownTypes[shownTypes.indexOf(widgetType) + by];
        return onto ? moveCard(list, widgetType, onto) : list;
      }),
    [onChange],
  );

  // Which card the dragged one's centre is over. Runs every frame of a drag
  // on the UI thread; React hears about it only when that card changes.
  useAnimatedReaction(
    () => {
      const type = drag.type.get();
      if (type === '') return null;
      return {
        type,
        x: drag.startX.get() + drag.tx.get() + drag.width.get() / 2,
        y:
          drag.startY.get() +
          drag.ty.get() +
          scroll.offset.get() -
          drag.scrollStart.get() +
          drag.height.get() / 2,
      };
    },
    (centre) => {
      if (centre === null) return;
      const all = rects.get();
      // A full-width card's centre sits on the gap between the columns, inside
      // neither half card, so it could only cross a row of them by being
      // dragged off to one side. It goes by height alone instead.
      const wide = drag.width.get() > cell.get() + GAP;
      let from = -1;
      for (let i = 0; i < all.length; i++) {
        if (all[i].widgetType === centre.type) from = i;
      }
      let hit = '';
      for (let i = 0; i < all.length; i++) {
        const rect = all[i];
        if (rect.widgetType === centre.type) continue;
        // The middle of the card, not its edge, so two cards of different
        // sizes do not trade places back and forth under a still finger.
        const insetX = rect.width * 0.2;
        const insetY = rect.height * 0.2;
        const over =
          (wide ||
            (centre.x > rect.x + insetX && centre.x < rect.x + rect.width - insetX)) &&
          centre.y > rect.y + insetY &&
          centre.y < rect.y + rect.height - insetY;
        if (!over) continue;
        hit = rect.widgetType;
        // Going up, take the row's first card, so the whole row goes under;
        // going down, its last, so the whole row comes up above.
        if (i < from) break;
      }
      if (hit === '') {
        drag.target.set('');
        return;
      }
      if (drag.target.get() !== hit) {
        drag.target.set(hit);
        scheduleOnRN(move, centre.type as CardWidgetType, hit as CardWidgetType);
      }
    },
  );

  // A card held near the top or bottom of the screen scrolls the hub, faster
  // the closer it gets, so a card can travel the whole board in one drag.
  useFrameCallback(() => {
    if (drag.type.get() === '') return;
    const top = scroll.top.get();
    const bottom = scroll.bottom.get();
    // Not measured yet: scrolling against an edge at 0 would run away.
    if (bottom <= top) return;
    const y = drag.absY.get();
    let delta = 0;
    if (y < top + EDGE) delta = -MAX_SCROLL_STEP * Math.min(1, (top + EDGE - y) / EDGE);
    else if (y > bottom - EDGE) delta = MAX_SCROLL_STEP * Math.min(1, (y - bottom + EDGE) / EDGE);
    if (delta === 0) return;
    const current = scroll.offset.get();
    const next = Math.min(Math.max(current + delta, scroll.min.get()), scroll.max.get());
    if (next !== current) scrollTo(scroll.ref, 0, next, false);
  });

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height, width: '100%' }}
    >
      {width > 0 &&
        frames.map(({ placement, frame }) => (
          <GridCard
            key={placement.widgetType}
            card={cards[placement.widgetType]}
            placement={placement}
            frame={frame}
            editing={editing}
            canHide={shown > 1}
            cell={cell}
            drag={drag}
            scrollOffset={scroll.offset}
            recolour={recolour}
            picking={openPicker === placement.widgetType}
            onTogglePicker={() =>
              setPicking((current) =>
                current === placement.widgetType ? null : placement.widgetType,
              )
            }
            onPick={(color) => {
              setPicking(null);
              recolour?.onPick(placement.widgetType, color);
            }}
            onOpen={onOpen}
            onStartEditing={onStartEditing}
            onDragging={dragging}
            onResize={resize}
            onHide={hide}
            onStep={step}
          />
        ))}
    </View>
  );
}

function GridCard({
  card,
  placement,
  frame,
  editing,
  canHide,
  cell,
  drag,
  scrollOffset,
  recolour,
  picking,
  onTogglePicker,
  onPick,
  onOpen,
  onStartEditing,
  onDragging,
  onResize,
  onHide,
  onStep,
}: {
  card: HubCard;
  placement: MobilePlacement;
  frame: Frame;
  editing: boolean;
  canHide: boolean;
  cell: SharedValue<number>;
  drag: Drag;
  scrollOffset: SharedValue<number>;
  recolour: HubRecolour | undefined;
  picking: boolean;
  onTogglePicker: () => void;
  onPick: (color: WidgetColor) => void;
  onOpen: (widgetType: CardWidgetType) => void;
  onStartEditing: () => void;
  onDragging: (dragging: boolean) => void;
  onResize: (widgetType: CardWidgetType, w: MobileSpan, h: MobileSpan) => void;
  onHide: (widgetType: CardWidgetType) => void;
  onStep: (widgetType: CardWidgetType, by: -1 | 1) => void;
}) {
  const colors = useThemeColors();
  const type = placement.widgetType;

  // Where the card is drawn, and the cell it belongs in. They differ while it
  // springs between cells, and while it is under the finger.
  const x = useSharedValue(frame.x);
  const y = useSharedValue(frame.y);
  // Size changes too (entering edit mode undoes the stretch; a resize lands),
  // and is animated rather than snapped. Width and height are a layout pass
  // per frame, which is fine for something this occasional; a scale would
  // smear the text.
  const width = useSharedValue(frame.width);
  const height = useSharedValue(frame.height);
  const press = useSharedValue(1);
  const slot = useSharedValue(frame);
  const size = useSharedValue({ w: placement.w, h: placement.h });
  const scale = useSharedValue(1);
  const resizing = useSharedValue(false);
  const snapW = useSharedValue<MobileSpan>(placement.w);
  const snapH = useSharedValue<MobileSpan>(placement.h);

  // The corner handle. Built here, not in the handle, because the card's own
  // drag has to know about it: a finger that lands on the corner resizes,
  // however long it is held before it moves.
  const resize = useMemo(
    () =>
      Gesture.Pan()
        .hitSlop(12)
        .onBegin(() => {
          resizing.set(true);
          // The corner is not a hold on the card: undo any sink it started.
          press.set(withSpring(1, SETTLE));
          snapW.set(size.get().w);
          snapH.set(size.get().h);
        })
        .onUpdate((event) => {
          const width = slot.get().width + event.translationX;
          const height = slot.get().height + event.translationY;
          // Past halfway into the next cell, it takes the cell.
          const w: MobileSpan = width > cell.get() * 1.5 + GAP / 2 ? 2 : 1;
          const h: MobileSpan = height > ROW_HEIGHT * 1.5 + GAP / 2 ? 2 : 1;
          if (w !== snapW.get() || h !== snapH.get()) {
            snapW.set(w);
            snapH.set(h);
            scheduleOnRN(tick);
          }
        })
        .onFinalize(() => {
          resizing.set(false);
          const w = snapW.get();
          const h = snapH.get();
          if (w !== size.get().w || h !== size.get().h) scheduleOnRN(onResize, type, w, h);
        }),
    [resizing, snapW, snapH, size, slot, cell, type, onResize, press],
  );

  useEffect(() => {
    slot.set(frame);
    size.set({ w: placement.w, h: placement.h });
    width.set(withTiming(frame.width, MORPH));
    height.set(withTiming(frame.height, MORPH));
    if (drag.type.get() === type) return;
    x.set(withSpring(frame.x, SETTLE));
    y.set(withSpring(frame.y, SETTLE));
  }, [frame, placement.w, placement.h, slot, size, drag, type, x, y, width, height]);

  // Memoised on what cannot change mid-drag: a gesture rebuilt while active
  // is cancelled, and every reorder re-renders this card.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(editing)
        .activateAfterLongPress(DRAG_HOLD)
        .simultaneousWithExternalGesture(resize)
        .onBegin(() => {
          if (resizing.get()) return;
          press.set(withTiming(SINK_SCALE, SINK_TO_DRAG));
        })
        .onStart((event) => {
          // A touch that began on the corner is a resize, not a move.
          if (resizing.get()) return;
          press.set(withSpring(1, SNAP));
          drag.type.set(type);
          drag.startX.set(x.get());
          drag.startY.set(y.get());
          drag.width.set(slot.get().width);
          drag.height.set(slot.get().height);
          drag.tx.set(0);
          drag.ty.set(0);
          drag.absY.set(event.absoluteY);
          drag.scrollStart.set(scrollOffset.get());
          drag.target.set(type);
          scale.set(withTiming(1.03, { duration: 150 }));
          scheduleOnRN(onDragging, true);
          scheduleOnRN(lift);
        })
        .onUpdate((event) => {
          drag.tx.set(event.translationX);
          drag.ty.set(event.translationY);
          drag.absY.set(event.absoluteY);
        })
        .onFinalize(() => {
          // Let go before the hold took, or a scroll took the touch over.
          press.set(withSpring(1, SETTLE));
          if (drag.type.get() !== type) return;
          scale.set(withTiming(1, { duration: 150 }));
          // Hand the drawn position over from the finger to the spring.
          x.set(drag.startX.get() + drag.tx.get());
          y.set(drag.startY.get() + drag.ty.get() + scrollOffset.get() - drag.scrollStart.get());
          drag.type.set('');
          x.set(withSpring(slot.get().x, SNAP));
          y.set(withSpring(slot.get().y, SNAP));
          scheduleOnRN(onDragging, false);
        }),
    [editing, type, drag, x, y, slot, scale, press, resizing, resize, scrollOffset, onDragging],
  );

  const animated = useAnimatedStyle(() => {
    const dragging = drag.type.get() === type;
    return {
      // Above its neighbours while dragged, or while its resize outline shows.
      zIndex: dragging ? 10 : resizing.get() ? 5 : 0,
      transform: [
        { translateX: dragging ? drag.startX.get() + drag.tx.get() : x.get() },
        {
          translateY: dragging
            ? drag.startY.get() + drag.ty.get() + scrollOffset.get() - drag.scrollStart.get()
            : y.get(),
        },
        { scale: scale.get() * press.get() },
      ],
      width: width.get(),
      height: height.get(),
    };
  });

  const title = card.title;
  const sizeLabel = `${placement.w} by ${placement.h}`;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
          },
          animated,
        ]}
        // A card appears or goes only in edit mode (showing or hiding it);
        // on load and when leaving the board, cards are just there.
        entering={editing ? FadeIn.duration(200) : undefined}
        exiting={editing ? FadeOut.duration(150) : undefined}
        // While editing, the card is one control with actions, because a
        // screen reader cannot drag or pull a corner.
        accessible={editing}
        accessibilityLabel={editing ? `${title}, ${sizeLabel}` : undefined}
        accessibilityActions={
          editing
            ? [
                { name: 'earlier', label: 'Move earlier' },
                { name: 'later', label: 'Move later' },
                {
                  name: 'wider',
                  label: placement.w === 1 ? 'Make wider' : 'Make narrower',
                },
                {
                  name: 'taller',
                  label: placement.h === 1 ? 'Make taller' : 'Make shorter',
                },
                ...(canHide ? [{ name: 'hide', label: 'Hide' }] : []),
                // A screen reader cannot reach the swatches inside a card
                // that is one control, so each colour is an action of its own.
                ...(recolour
                  ? WidgetColors.filter((color) => color !== card.slot).map((color) => ({
                      name: `colour:${color}`,
                      label: `Colour ${slotLabel(recolour.palette, color)}`,
                    }))
                  : []),
              ]
            : undefined
        }
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          if (action === 'earlier') onStep(type, -1);
          if (action === 'later') onStep(type, 1);
          if (action === 'wider') onResize(type, placement.w === 1 ? 2 : 1, placement.h);
          if (action === 'taller') onResize(type, placement.w, placement.h === 1 ? 2 : 1);
          if (action === 'hide') onHide(type);
          if (action.startsWith('colour:')) onPick(action.slice('colour:'.length) as WidgetColor);
        }}
      >
        <HubStatCard
          card={card}
          tall={placement.h === 2}
          onPress={editing ? undefined : () => onOpen(type)}
          onLongPress={
            editing
              ? undefined
              : () => {
                  // The hold took: pop back up as edit mode starts.
                  press.set(withSpring(1, SNAP));
                  onStartEditing();
                }
          }
          onPressIn={editing ? undefined : () => press.set(withTiming(SINK_SCALE, SINK_TO_EDIT))}
          onPressOut={editing ? undefined : () => press.set(withSpring(1, SETTLE))}
        />

        {editing && (
          <>
            {recolour && picking && (
              <ColourPicker
                palette={recolour.palette}
                value={card.slot}
                title={title}
                onPick={onPick}
              />
            )}
            {recolour && (
              <EditButton
                icon={{ sf: 'paintpalette.fill', md: 'palette' }}
                label={picking ? `Close ${title} colours` : `Change ${title} colour`}
                disabled={false}
                onPress={onTogglePicker}
                style={{ top: -spacing.xs, left: -spacing.xs }}
                colors={colors}
              />
            )}
            <EditButton
              icon={{ sf: 'eye.slash', md: 'visibility-off' }}
              label={`Hide ${title}`}
              disabled={!canHide}
              onPress={() => onHide(type)}
              style={{ top: -spacing.xs, right: -spacing.xs }}
              colors={colors}
            />
            <ResizeHandle
              gesture={resize}
              active={resizing}
              snapW={snapW}
              snapH={snapH}
              cell={cell}
              colors={colors}
            />
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * The palette's colours laid over the card, in web's colour menu's order,
 * with the card's own one ticked. A pick repaints the card straight away and
 * is saved with Done, like the rest of edit mode.
 */
function ColourPicker({
  palette,
  value,
  title,
  onPick,
}: {
  palette: BoardPalette;
  value: WidgetColor;
  title: string;
  onPick: (color: WidgetColor) => void;
}) {
  const scheme = useScheme();
  const colors = useThemeColors();
  const shadows = useShadows();
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(100)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
      }}
      pointerEvents="box-none"
    >
      <View
        accessibilityLabel={`${title} colours`}
        style={{
          flexDirection: 'row',
          gap: 4,
          padding: 4,
          borderRadius: radius.full,
          backgroundColor: colors.background,
          boxShadow: shadows.card,
        }}
      >
        {WidgetColors.map((color) => {
          const tokens = cardTokens(palette, scheme, color);
          const chosen = color === value;
          return (
            <Pressable
              key={color}
              accessibilityRole="button"
              accessibilityLabel={slotLabel(palette, color)}
              accessibilityState={{ selected: chosen }}
              onPress={() => onPick(color)}
              hitSlop={4}
              style={({ pressed }) => ({
                width: 28,
                height: 28,
                borderRadius: radius.full,
                backgroundColor: tokens.card,
                borderWidth: chosen ? 2 : 1,
                borderColor: chosen ? colors.foreground : colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: pressed ? 0.9 : 1 }],
              })}
            >
              {chosen && (
                <Icon name={{ sf: 'checkmark', md: 'check' }} size={12} color={tokens.cardForeground} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

/**
 * The corner you drag to resize, as on web. The card snaps between one and two
 * cells each way; while dragging, an outline shows the size it will take.
 */
function ResizeHandle({
  gesture,
  active,
  snapW,
  snapH,
  cell,
  colors,
}: {
  gesture: ReturnType<typeof Gesture.Pan>;
  active: SharedValue<boolean>;
  snapW: SharedValue<MobileSpan>;
  snapH: SharedValue<MobileSpan>;
  cell: SharedValue<number>;
  colors: ReturnType<typeof useThemeColors>;
}) {
  // A childless outline, so animating its size re-lays-out nothing else.
  const outline = useAnimatedStyle(() => ({
    opacity: withTiming(active.get() ? 1 : 0, { duration: 150 }),
    width: withSpring(span(snapW.get(), cell.get()), SETTLE),
    height: withSpring(snapH.get() * ROW_HEIGHT + (snapH.get() - 1) * GAP, SETTLE),
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: colors.primary,
          },
          outline,
        ]}
      />
      <GestureDetector gesture={gesture}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[handleStyle(colors), { bottom: -spacing.xs, right: -spacing.xs }]}
        >
          <Icon
            name={{
              sf: 'arrow.up.left.and.arrow.down.right',
              md: 'open-in-full',
            }}
            size={11}
            color={colors.primaryForeground}
          />
        </View>
      </GestureDetector>
    </>
  );
}

function EditButton({
  icon,
  label,
  disabled,
  onPress,
  style,
  colors,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
  style: { top?: number; right?: number; bottom?: number; left?: number };
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        handleStyle(colors),
        style,
        { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} size={12} color={colors.primaryForeground} />
    </Pressable>
  );
}

const handleStyle = (colors: ReturnType<typeof useThemeColors>) =>
  ({
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  }) as const;
