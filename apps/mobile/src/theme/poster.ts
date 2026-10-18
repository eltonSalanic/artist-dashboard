import type { TextStyle } from 'react-native';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';
import { Figtree_900Black } from '@expo-google-fonts/figtree/900Black';
import {
  WIDGET_META,
  resolveWidgetColor,
  type BoardTheme,
  type ColorScheme,
  type WidgetColor,
  type WidgetType,
} from '@artist/shared';
import { cardTokens, useScheme } from './colors';
import { posterCanvas, posterSlot, type PosterCanvas, type PosterColor } from './poster-colors';
import { useBoardPalette } from './tokens';

export * from './poster-colors';

/**
 * The "Wrapped" design language for the hub and the calendar: one heavy
 * geometric face, set huge and tight, on flat blocks of the band's colour.
 *
 * **Figtree** is the free face closest to Spotify's Circular — geometric,
 * single-storey `a`, round dots — and unlike most Circular stand-ins it has a
 * true Black (900), which is what makes a number read as a poster rather than
 * as a stat. Loaded at runtime with `expo-font` (already in every Expo build),
 * so no native rebuild. Only four weights ship; each import is one file, so
 * the other ten in the package never reach the bundle.
 *
 * Custom families carry their weight in the name, so **never pair these with
 * `fontWeight`** — on iOS that makes the system go looking for a synthetic
 * bold of a face that is already bold.
 */
export const POSTER_FONTS = {
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  Figtree_900Black,
};

export const face = {
  black: 'Figtree_900Black',
  heavy: 'Figtree_800ExtraBold',
  bold: 'Figtree_700Bold',
  semi: 'Figtree_600SemiBold',
  medium: 'Figtree_500Medium',
} as const;

/**
 * The ramp. Every style sets `lineHeight`, at least ~1.1× the size: iOS clips
 * a glyph that pokes out of its line box, and Figtree Black's numerals are
 * tall. The *visual* tightness comes from negative tracking and from the
 * layout's gaps, never from a squeezed line box.
 *
 * `maxFontSizeMultiplier` keeps Dynamic Type from blowing a 96pt numeral past
 * its block; body-sized text is allowed to scale further than display text.
 */
export const poster = {
  /** The hub hero's number. */
  mega: { fontFamily: face.black, fontSize: 96, lineHeight: 104, letterSpacing: -4 },
  /** A block's number, a calendar day. */
  figure: { fontFamily: face.black, fontSize: 58, lineHeight: 64, letterSpacing: -2.2 },
  /** The band's name, the month. */
  display: { fontFamily: face.black, fontSize: 40, lineHeight: 46, letterSpacing: -1.4 },
  /** The sentence under a hero number. */
  statement: { fontFamily: face.heavy, fontSize: 30, lineHeight: 34, letterSpacing: -0.9 },
  /** Prose on a block (Focus, Notes), an event's title. */
  title: { fontFamily: face.heavy, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
  /**
   * A widget card, set the way Spotify sets its cards: a bold sentence-case
   * title rather than spaced small caps, a heavy number tracked tight, and
   * secondary text a step lighter than the title.
   */
  cardTitle: { fontFamily: face.bold, fontSize: 15, lineHeight: 20, letterSpacing: -0.3 },
  stat: {
    fontFamily: face.heavy,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.6,
    fontVariant: ['tabular-nums'],
  },
  prose: { fontFamily: face.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.35 },
  cardMeta: { fontFamily: face.medium, fontSize: 13, lineHeight: 17, letterSpacing: -0.1 },
  /** A filter chip's label. */
  chip: { fontFamily: face.semi, fontSize: 14, lineHeight: 18, letterSpacing: -0.1 },
  /** A list row's title, like a Spotify track name. */
  rowTitle: { fontFamily: face.semi, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  /** The words after a block's number. */
  caption: { fontFamily: face.bold, fontSize: 16, lineHeight: 20, letterSpacing: -0.2 },
  body: { fontFamily: face.semi, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  /** Running text someone wrote: a description, a comment. Lighter than
   *  `body`, with more lead, because it can run to a paragraph. */
  paragraph: { fontFamily: face.medium, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  meta: { fontFamily: face.semi, fontSize: 13, lineHeight: 17, letterSpacing: 0 },
  /** Small caps labels: a block's name, a kind. */
  label: { fontFamily: face.heavy, fontSize: 11, lineHeight: 14, letterSpacing: 1.1 },
} as const satisfies Record<string, TextStyle>;

/** Display sizes scale a little with Dynamic Type; body sizes scale more. */
export const DISPLAY_SCALE = 1.15;
export const BODY_SCALE = 1.4;

/**
 * Spotify's corners are small — album art is nearly square — and a poster's
 * edge should read as cut paper, not as a phone widget's squircle. Still
 * continuous, still not sharp.
 */
export const posterRadius = {
  block: 14,
  chip: 9999,
} as const;

/** Generous: blocks are posters on a wall, they need air between them. */
export const posterGap = 12;

/** The page behind the posters, for this scheme. */
export function usePosterCanvas(): PosterCanvas {
  return posterCanvas(useScheme());
}

/** One block's colours, in the selected board's palette. */
export function usePosterSlot(slot: WidgetColor): PosterColor {
  return posterSlot(useBoardPalette(), useScheme(), slot);
}

/** A widget's own colours: what its card on the widget page is painted with. */
export interface WidgetInk {
  bg: string;
  ink: string;
  soft: string;
  /** The widget is uncoloured: a plain card, which needs its shadow to show. */
  plain: boolean;
}

/**
 * The page itself as an ink, for a pill or control that sits on the canvas
 * rather than on a block: canvas-coloured fill, page ink for the words.
 */
export function useCanvasInk(): WidgetInk {
  const canvas = usePosterCanvas();
  return { bg: canvas.background, ink: canvas.ink, soft: canvas.soft, plain: true };
}

/** A palette block's colours, as the ink a `PosterPill` or block paints with. */
export function blockInk(color: PosterColor): WidgetInk {
  return { bg: color.bg, ink: color.ink, soft: color.soft, plain: false };
}

/**
 * The colours a band gave one widget, worked out exactly as the widget page
 * does (`use-hub-cards`), so a show on the calendar is the colour of the
 * Shows card and a rehearsal the colour of Next Rehearsals.
 */
export function widgetInk(
  theme: BoardTheme,
  widgetType: WidgetType,
  scheme: ColorScheme,
): WidgetInk {
  const slot = resolveWidgetColor(
    theme,
    widgetType,
    WIDGET_META[widgetType].defaultColor ?? 'base',
  );
  const tokens = cardTokens(theme.palette, scheme, slot);
  return {
    bg: tokens.card,
    ink: tokens.cardForeground,
    soft: tokens.mutedForeground,
    plain: slot === 'base',
  };
}
