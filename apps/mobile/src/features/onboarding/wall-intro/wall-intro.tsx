import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import type { BoardPalette } from '@artist/shared';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { HubStatCard } from '@/components/stat-card';
import { ROW_HEIGHT } from '@/features/board/hub-grid';
import { MastheadTitle } from '@/features/board/masthead';
import {
  BoardPaletteProvider,
  posterSlot,
  spacing,
  usePosterCanvas,
  useScheme,
  type PosterColor,
} from '@/theme';
import { DEMO_BANDS, type DemoBand } from './bands';
import { DEMO_LAYOUT, DEMO_ROWS, HEADLINES, demoCard, type DemoCell } from './demo-wall';
import {
  BEATS,
  BEAT_START,
  CUT,
  REST,
  SHRINK,
  SPRING,
  TOTAL,
  beatAt,
  cameraAt,
  landing,
  phonePose,
  progress,
  sweep,
} from './timeline';

/** What the buttons under the preview paint with. */
export interface IntroLook {
  palette: BoardPalette;
  /** The band's lead colour once the wall has become a phone on it; null before. */
  poster: PosterColor | null;
}

const GAP = spacing.sm;
/** The prototype was laid out on an iPhone 15: 390 × 844. */
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;
/** How far above the buttons the wall starts to fade out. */
const FADE_LEAD = 88;
/** How tall the fade itself is. */
const FADE = 80;
/** The phone's thickness, as layers stacked behind its screen. */
const EDGES = [1, 2, 3, 4, 5, 6, 7, 8];
const DEG = Math.PI / 180;

/**
 * The welcome screen's preview: a band's hub building itself, the way a
 * Spotify Wrapped story plays. The name slides in, the real widget cards are
 * thrown onto the grid under three headlines, and then the whole wall shrinks
 * into a phone on the band's colour. Every loop it's a different band.
 *
 * The cards are `HubStatCard` and the name is the hub's own masthead, so the
 * preview can't drift from what someone will actually get.
 *
 * Tap the right side to skip a beat, the left to go back. With Reduce Motion
 * on, each beat is a still frame that changes on the same rhythm.
 */
export function WallIntro({ footer }: { footer: (look: IntroLook) => ReactNode }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const canvas = usePosterCanvas();
  const scheme = useScheme();
  const reduced = useReducedMotion();

  const [bandIndex, setBandIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [cut, setCut] = useState(false);
  const [gridBottom, setGridBottom] = useState(0);
  const [footTop, setFootTop] = useState(height);

  const band = DEMO_BANDS[bandIndex];
  const lead = posterSlot(band.palette, scheme, 'c1');
  const ink = cut ? lead.ink : canvas.ink;

  const t = useSharedValue<number>(reduced ? REST[0] : 0);
  const pan = useSharedValue(0);

  const nextBand = useCallback(() => setBandIndex((i) => (i + 1) % DEMO_BANDS.length), []);

  const clock = useFrameCallback((frame) => {
    // A dropped second (an alert, a slow frame) shouldn't skip half a beat.
    let next = t.get() + Math.min(100, frame.timeSincePreviousFrame ?? 0);
    if (next >= TOTAL) {
      next = 0;
      scheduleOnRN(nextBand);
    }
    t.set(next);
  }, false);

  // Only while the welcome screen is showing: under sign-in it would keep
  // rendering a wall nobody can see.
  useFocusEffect(
    useCallback(() => {
      clock.setActive(!reduced);
      return () => clock.setActive(false);
    }, [clock, reduced]),
  );

  const go = useCallback(
    (target: number) => {
      if (target >= BEATS.length) nextBand();
      else if (target < 0) setBandIndex((i) => (i - 1 + DEMO_BANDS.length) % DEMO_BANDS.length);
      const next = (target + BEATS.length) % BEATS.length;
      setBeat(next);
      t.set(reduced ? REST[next] : BEAT_START[next]);
    },
    [nextBand, reduced, t],
  );

  // Reduced motion: a still frame per beat, moving on at the beat's pace.
  useEffect(() => {
    if (!reduced) return;
    const timer = setTimeout(() => go(beat + 1), BEATS[beat]);
    return () => clearTimeout(timer);
  }, [reduced, beat, bandIndex, go]);

  const step = (direction: 1 | -1) => {
    const now = t.get();
    const current = beatAt(now);
    // Like a story: back restarts the beat, unless it has only just begun.
    if (direction < 0 && !reduced && now - BEAT_START[current] > 700) go(current);
    else go(current + direction);
  };

  useAnimatedReaction(
    () => t.get() >= CUT,
    (now, before) => {
      if (now !== before) scheduleOnRN(setCut, now);
    },
  );

  // The camera rides down far enough for Finances to land clear of the fade.
  useEffect(() => {
    pan.set(Math.max(0, gridBottom - (footTop - FADE_LEAD)));
  }, [gridBottom, footTop, pan]);

  const k = width / BASE_WIDTH;
  const barsTop = insets.top + 6;
  const brandTop = insets.top + 18;
  const phoneTop = Math.max(height * (196 / BASE_HEIGHT), brandTop + 2 * 46 + spacing.lg);
  // Room for the spring's overshoot too, so the phone never dips onto the buttons.
  const phoneRoom = footTop - spacing.lg - phoneTop * 1.12;
  const phoneScale = Math.min(0.5, Math.max(0.36, phoneRoom / height));
  const gridWidth = width - 2 * spacing.md;
  const cellWidth = (gridWidth - GAP) / 2;
  const legalBottom = Math.max(insets.bottom - 8, spacing.sm);

  const camStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -pan.get() * cameraAt(t.get()) }],
  }));
  const devStyle = useAnimatedStyle(() => {
    const pose = phonePose(t.get(), phoneTop, phoneScale);
    return {
      transform: [
        { perspective: 1500 },
        { translateY: pose.y },
        { rotateX: `${pose.rx}deg` },
        { rotateY: `${pose.ry}deg` },
        { rotateZ: `${pose.rz}deg` },
        { scale: pose.scale },
      ],
    };
  });
  const screenStyle = useAnimatedStyle(() => ({ borderRadius: t.get() >= CUT ? 54 * k : 0 }));
  const afterCut = useAnimatedStyle(() => ({ opacity: t.get() >= CUT ? 1 : 0 }));
  const beforeCut = useAnimatedStyle(() => ({ opacity: t.get() >= CUT ? 0 : 1 }));
  // The phone's own status bar, once the wall has ridden back up from under it.
  const statusStyle = useAnimatedStyle(() => ({ opacity: progress(t.get(), CUT + 600, 200) }));
  const floorStyle = useAnimatedStyle(() => {
    const e = SPRING(progress(t.get(), CUT + 200, SHRINK));
    return {
      opacity: t.get() >= CUT + 200 ? Math.min(1, e) : 0,
      transform: [{ scaleX: 0.6 + 0.4 * e }],
    };
  });
  const dateStyle = useAnimatedStyle(() => ({
    opacity: t.get() >= 80 ? 1 : 0,
    transform: [{ translateY: 8 * (1 - SPRING(progress(t.get(), 80, 300))) }],
  }));
  const nameStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -1.1 * width * (1 - SPRING(progress(t.get(), 140, 520))) }],
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ scale: SPRING(progress(t.get(), 520, 420)) }],
  }));

  const accessibilityLabel = `An example wall for ${band.name}: shows, rehearsals, to-dos, goals, reminders, notes and money, all in one place.`;

  return (
    <View style={{ flex: 1, backgroundColor: canvas.background, overflow: 'hidden' }}>
      <StatusBar style={cut ? (isLight(lead.ink) ? 'light' : 'dark') : 'auto'} />

      <View
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          step(event.nativeEvent.actionName === 'decrement' ? -1 : 1)
        }
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: lead.bg }, afterCut]}
        />
        <Animated.View
          style={[
            styles.floor,
            { top: phoneTop + height * phoneScale - 8, left: 60, right: 60 },
            floorStyle,
          ]}
        />

        {/* Its own native layer (`collapsable={false}`, or Fabric flattens a
            plain wrapper away): iOS depth-sorts a 3D-tilted view against its
            siblings, which hid everything on the far side of the phone's
            tilt behind the band's colour. */}
        <View collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              { position: 'absolute', left: 0, top: 0, width, height },
              styles.device,
              devStyle,
            ]}
          >
            {EDGES.map((layer) => (
              <Edge key={layer} layer={layer} t={t} k={k} top={phoneTop} scale={phoneScale} />
            ))}
            <Animated.View
              style={[
                styles.bezel,
                { inset: -13 * k, borderRadius: 67 * k },
                afterCut,
              ]}
            />
            {SIDE_BUTTONS.map((button) => (
              <Animated.View
                key={`${button.side}${button.top}`}
                style={[
                  styles.sideButton,
                  {
                    [button.side]: -17 * k,
                    top: button.top * k,
                    height: button.height * k,
                    width: 5 * k,
                  },
                  afterCut,
                ]}
              />
            ))}

            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: canvas.background, overflow: 'hidden' },
                screenStyle,
              ]}
            >
              <Animated.View
                style={[
                styles.fakeStatus,
                { top: 15 * k, paddingHorizontal: 34 * k },
                statusStyle,
              ]}
              >
                <PosterText variant="body" color={canvas.ink}>
                  9:41
                </PosterText>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Icon
                    name={{ sf: 'cellularbars', md: 'signal-cellular-alt' }}
                    size={15}
                    color={canvas.ink}
                  />
                  <Icon
                    name={{ sf: 'battery.100', md: 'battery-full' }}
                    size={15}
                    color={canvas.ink}
                  />
                </View>
              </Animated.View>

              <Animated.View
                style={[
                  {
                    paddingTop: barsTop + spacing.lg,
                    paddingHorizontal: spacing.md,
                    gap: spacing.md,
                  },
                  camStyle,
                ]}
              >
                <View style={{ gap: 2 }}>
                  <MastheadTitle
                    name={band.name}
                    motion={{ date: dateStyle, name: nameStyle, chevron: chevronStyle }}
                  />
                </View>
                <View
                  onLayout={(event) => {
                    const { y, height: gridHeight } = event.nativeEvent.layout;
                    setGridBottom(y + gridHeight);
                  }}
                  style={{ height: DEMO_ROWS * ROW_HEIGHT + (DEMO_ROWS - 1) * GAP }}
                >
                  <BoardPaletteProvider palette={band.palette}>
                    {DEMO_LAYOUT.map((cell) => (
                      <LandingCard
                        key={cell.type}
                        cell={cell}
                        band={band}
                        t={t}
                        cellWidth={cellWidth}
                        gridWidth={gridWidth}
                        width={width}
                        height={height}
                      />
                    ))}
                  </BoardPaletteProvider>
                </View>
              </Animated.View>
            </Animated.View>

            <Animated.View
              style={[
                styles.island,
                {
                  top: 11 * k,
                  width: 122 * k,
                  height: 36 * k,
                  marginLeft: -61 * k,
                  borderRadius: 18 * k,
                },
                afterCut,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, styles.glare, { borderRadius: 54 * k }, afterCut]}
            />
          </Animated.View>
        </View>

        {/* The wall fades out above the buttons, and under the progress bars. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { top: footTop - FADE_LEAD }, beforeCut]}
        >
          <View
            style={{
              height: FADE,
              experimental_backgroundImage: `linear-gradient(to bottom, ${alpha(canvas.background, 0)}, ${canvas.background})`,
            }}
          />
          <View style={{ flex: 1, backgroundColor: canvas.background }} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.mask, beforeCut]}
        >
          <View style={{ height: barsTop + 10, backgroundColor: canvas.background }} />
          <View
            style={{
              height: 26,
              experimental_backgroundImage: `linear-gradient(to bottom, ${canvas.background}, ${alpha(canvas.background, 0)})`,
            }}
          />
        </Animated.View>

        <View pointerEvents="none" style={[styles.brand, { top: brandTop }]}>
          {['It all lives', 'on Band Wall.'].map((line, index) => (
            <BrandLine key={line} line={line} index={index} t={t} color={lead.ink} />
          ))}
        </View>

        {HEADLINES.map((headline) => (
          <Headline
            key={headline.text}
            text={headline.text}
            at={headline.at}
            top={headline.top * (height / BASE_HEIGHT)}
            tilt={headline.tilt}
            colour={posterSlot(band.palette, scheme, headline.slot)}
            t={t}
            width={width}
          />
        ))}

        <View pointerEvents="none" style={[styles.bars, { top: barsTop }]}>
          {BEATS.map((_, index) => (
            <Bar key={index} index={index} t={t} color={ink} />
          ))}
        </View>

        <View
          style={[styles.taps, { top: insets.top, height: Math.max(0, footTop - insets.top) }]}
        >
          <Pressable style={{ flex: 1 }} onPress={() => step(-1)} />
          <Pressable style={{ flex: 1 }} onPress={() => step(1)} />
        </View>
      </View>

      <View
        onLayout={(event) => setFootTop(event.nativeEvent.layout.y)}
        style={[styles.foot, { bottom: legalBottom + 22 }]}
      >
        {footer({ palette: band.palette, poster: cut ? lead : null })}
      </View>
      <PosterText
        variant="meta"
        color={cut ? lead.soft : canvas.soft}
        style={[styles.legal, { bottom: legalBottom }]}
      >
        {"Band names for illustration only. Band Wall isn't affiliated with or endorsed by these bands."}
      </PosterText>
    </View>
  );
}

const SIDE_BUTTONS = [
  { side: 'left', top: 150, height: 30 },
  { side: 'left', top: 210, height: 58 },
  { side: 'left', top: 280, height: 58 },
  { side: 'right', top: 240, height: 92 },
] as const;

/** One widget card, thrown in from off screen at its moment. */
function LandingCard({
  cell,
  band,
  t,
  cellWidth,
  gridWidth,
  width,
  height,
}: {
  cell: DemoCell;
  band: DemoBand;
  t: SharedValue<number>;
  cellWidth: number;
  gridWidth: number;
  width: number;
  height: number;
}) {
  // [x, y, rotation] at the start of the throw.
  const from =
    cell.from === 'left'
      ? [-(width + 80), 40, -14]
      : cell.from === 'right'
        ? [width + 80, 60, 14]
        : [0, height * 0.75, 6];
  const style = useAnimatedStyle(() => {
    const { shown, away, scale } = landing(t.get(), cell.lands);
    return {
      opacity: shown ? 1 : 0,
      transform: [
        { translateX: from[0] * away },
        { translateY: from[1] * away },
        { rotate: `${from[2] * away}deg` },
        { scale },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cell.col * (cellWidth + GAP),
          top: cell.row * (ROW_HEIGHT + GAP),
          width: cell.wide ? gridWidth : cellWidth,
          height: ROW_HEIGHT,
        },
        style,
      ]}
    >
      <HubStatCard card={demoCard(cell.type, band)} />
    </Animated.View>
  );
}

/** A headline on a tilted band of colour that sweeps across the wall. */
function Headline({
  text,
  at,
  top,
  tilt,
  colour,
  t,
  width,
}: {
  text: string;
  at: number;
  top: number;
  tilt: number;
  colour: PosterColor;
  t: SharedValue<number>;
  width: number;
}) {
  // Wider than the screen, so its ends stay off screen when it's tilted.
  const bandWidth = width + 120;
  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt}deg` }, { translateX: sweep(t.get(), at).band * bandWidth }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep(t.get(), at).words * bandWidth }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.headline, { top, width: bandWidth, backgroundColor: colour.bg }, bandStyle]}
    >
      <Animated.View style={[{ width: width + 12 }, wordStyle]}>
        <PosterText variant="figure" color={colour.ink}>
          {text}
        </PosterText>
      </Animated.View>
    </Animated.View>
  );
}

/** One line of "It all lives on Band Wall.", stamped down from twice its size. */
function BrandLine({
  line,
  index,
  t,
  color,
}: {
  line: string;
  index: number;
  t: SharedValue<number>;
  color: string;
}) {
  const at = CUT + 380 + index * 190;
  const style = useAnimatedStyle(() => ({
    opacity: t.get() >= at ? 1 : 0,
    transform: [{ scale: 2.4 - 1.4 * SPRING(progress(t.get(), at, 380)) }],
  }));
  return (
    <Animated.View style={[{ alignSelf: 'flex-start', transformOrigin: '0% 70%' }, style]}>
      <PosterText variant="display" color={color}>
        {line}
      </PosterText>
    </Animated.View>
  );
}

/** A story-style progress bar for one beat. */
function Bar({ index, t, color }: { index: number; t: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress(t.get(), BEAT_START[index], BEATS[index]) }],
  }));
  return (
    <View style={styles.bar}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.25 }]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: color, transformOrigin: 'left' },
          style,
        ]}
      />
    </View>
  );
}

/**
 * One layer of the phone's side. Stacked a step further back each, and
 * shifted the way the phone is turned, they read as its thickness.
 */
function Edge({
  layer,
  t,
  k,
  top,
  scale,
}: {
  layer: number;
  t: SharedValue<number>;
  k: number;
  top: number;
  scale: number;
}) {
  const style = useAnimatedStyle(() => {
    const pose = phonePose(t.get(), top, scale);
    const depth = layer * 1.2 * k;
    return {
      opacity: t.get() >= CUT ? 1 : 0,
      transform: [
        { translateX: -depth * Math.sin(pose.ry * DEG) },
        { translateY: depth * Math.sin(pose.rx * DEG) },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.edge, { inset: -13 * k, borderRadius: 67 * k }, style]}
    />
  );
}

/** `#rrggbb` at an alpha, for a gradient that fades to nothing in the same colour. */
function alpha(hex: string, amount: number): string {
  const byte = Math.round(amount * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${byte}`;
}

/** Whether a `#rrggbb` colour is light enough to want dark words on it. */
function isLight(hex: string): boolean {
  const channel = (offset: number) => parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5) > 0.5;
}

const styles = StyleSheet.create({
  device: { transformOrigin: 'top' },
  floor: {
    position: 'absolute',
    height: 90,
    experimental_backgroundImage:
      'radial-gradient(closest-side, rgba(0,0,0,0.45), rgba(0,0,0,0))',
  },
  edge: { position: 'absolute', backgroundColor: '#1d1c1f' },
  bezel: {
    position: 'absolute',
    experimental_backgroundImage:
      'linear-gradient(115deg, #5b5a5f 0%, #2b2a2e 18%, #1a191c 45%, #3a393d 72%, #68676c 100%)',
    boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.18), inset 0 0 0 6px #0c0c0d',
  },
  sideButton: {
    position: 'absolute',
    borderRadius: 2,
    experimental_backgroundImage: 'linear-gradient(90deg, #2a292d, #5a595e, #2a292d)',
  },
  fakeStatus: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  island: { position: 'absolute', left: '50%', backgroundColor: '#000' },
  glare: {
    experimental_backgroundImage:
      'linear-gradient(118deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 28%, rgba(255,255,255,0) 42%, rgba(255,255,255,0) 100%)',
  },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  mask: { position: 'absolute', left: 0, right: 0, top: 0 },
  brand: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  headline: {
    position: 'absolute',
    left: -60,
    paddingTop: 22,
    paddingBottom: 24,
    paddingLeft: 84,
  },
  bars: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  taps: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  foot: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  legal: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    opacity: 0.75,
  },
});
