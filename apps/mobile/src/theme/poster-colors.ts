import {
  BOARD_PALETTE_COLORS,
  SURFACE_TOKENS,
  oklchToHex,
  type BoardPalette,
  type ColorScheme,
  type Oklch,
  type WidgetColor,
} from '@artist/shared';

/**
 * Colour for the "Wrapped" poster screens (the hub and the calendar).
 *
 * The idea is Spotify Wrapped's: every block is one flat, saturated colour with
 * one strongly contrasting ink on it, and nothing in between — no tints, no
 * veils, no muted greys on colour. The colours are the band's own palette
 * (`BOARD_PALETTE_COLORS`, read, never edited — web has a drift test on that
 * file), pushed a little more vivid, and the ink is *picked*, not authored: for
 * each block the darker or lighter of two hue-tinted inks, whichever contrasts
 * more. `poster-colors.spec.ts` walks every palette, scheme and slot and
 * fails if any pairing drops under 4.5:1 (6:1 for the main ink).
 *
 * Pure functions with no React Native import, so Jest can run them.
 */

/** One block: what it is painted with and what is written on it. */
export interface PosterColor {
  /** The block itself. */
  bg: string;
  /** Every word on the block. Always ≥ 6:1 against `bg`. */
  ink: string;
  /** Secondary words (labels, meta). Ink at reduced alpha, still ≥ 4.5:1. */
  soft: string;
  /**
   * A second colour for one huge numeral (the S4A hero's pink-on-purple).
   * Another colour from the same palette when it clears 3:1 — the large-text
   * threshold, and these numerals are 60pt+ — otherwise the ink.
   */
  accent: string;
  /** True when the ink is the light one: the block is dark. */
  dark: boolean;
}

/** The page behind the blocks. */
export interface PosterCanvas {
  background: string;
  ink: string;
  soft: string;
  /** Hairlines and dividers. Decorative only — never carries text. */
  rule: string;
  /** Skeleton bones and outlined pills. */
  faint: string;
}

/** How much more vivid a block is than the palette's authored card colour. */
const CHROMA_BOOST = 1.3;
const MAX_CHROMA = 0.24;
/** The alpha for `soft`: as low as it can go and stay ≥ 4.5:1 on every block. */
const SOFT_ALPHA = 0.8;

/**
 * The page is the app's own canvas (the warm cream, or charcoal in the dark),
 * so the calendar and the widget page sit on the same ground as the widget
 * cards, and a band's uncoloured widget looks the same in both places.
 */
export function posterCanvas(scheme: ColorScheme): PosterCanvas {
  const page = SURFACE_TOKENS[scheme];
  return {
    background: oklchToHex(page.background),
    ink: oklchToHex(page.foreground),
    soft: oklchToHex(page.mutedForeground),
    rule: oklchToHex({ ...page.foreground, alpha: 0.14 }),
    faint: oklchToHex({ ...page.foreground, alpha: 0.08 }),
  };
}

/** The palette slots in reading order. */
export const POSTER_SLOTS = ['c1', 'c2', 'c3', 'c4'] as const;
export type PosterSlot = (typeof POSTER_SLOTS)[number];

const cache = new Map<string, PosterColor>();

/**
 * A block's colours. `base` (the neutral card on web) becomes a block of the
 * canvas's own ink — black on paper, raised charcoal on black — so even an
 * uncoloured widget is a solid poster rather than a pale card.
 */
export function posterSlot(
  palette: BoardPalette,
  scheme: ColorScheme,
  slot: WidgetColor,
): PosterColor {
  const key = `${palette}:${scheme}:${slot}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const bg = slot === 'base' ? baseBlock(scheme) : vivid(BOARD_PALETTE_COLORS[palette][scheme][slot].bg);
  const resolved = paint(bg, accentsFor(palette, scheme, slot));
  cache.set(key, resolved);
  return resolved;
}

function baseBlock(scheme: ColorScheme): Oklch {
  return scheme === 'light' ? { l: 0.2, c: 0.006, h: 60 } : { l: 0.27, c: 0.006, h: 70 };
}

function vivid(color: Oklch): Oklch {
  return { ...color, c: Math.min(color.c * CHROMA_BOOST, MAX_CHROMA) };
}

/** The other colours of the palette, in the order a numeral should try them. */
function accentsFor(palette: BoardPalette, scheme: ColorScheme, slot: WidgetColor): Oklch[] {
  const slots = BOARD_PALETTE_COLORS[palette][scheme];
  // c1 is the palette's lead colour, then the brighter tints before the deeps.
  return (['c1', 'c3', 'c2', 'c4'] as const)
    .filter((other) => other !== slot)
    .map((other) => vivid(slots[other].bg));
}

function paint(authored: Oklch, accents: Oklch[]): PosterColor {
  // A mid-lightness colour (moss, slate, rust) sits where neither ink reaches
  // a comfortable ratio, so the block is walked a step at a time away from
  // the middle — darker under light ink, lighter under dark — until its soft
  // ink clears AA. The hue and chroma stay; most blocks never move at all.
  let bg = authored;
  let picked = pickInk(bg);
  for (let step = 0; step < 30 && contrast(picked.soft, picked.bgHex) < MIN_SOFT; step += 1) {
    bg = { ...bg, l: bg.l + (picked.light ? -0.01 : 0.01) };
    picked = pickInk(bg);
  }

  const accent =
    accents.map(oklchToHex).find((candidate) => contrast(candidate, picked.bgHex) >= 3) ??
    picked.ink;

  return {
    bg: picked.bgHex,
    ink: picked.ink,
    soft: picked.soft,
    accent,
    dark: picked.light,
  };
}

/** Comfortably over 4.5:1, so rounding to 8-bit never tips it under. */
const MIN_SOFT = 4.7;

function pickInk(bg: Oklch) {
  const bgHex = oklchToHex(bg);
  // Inks carry a little of the block's hue, so lime gets a deep olive and plum
  // a pinkish cream — the Wrapped trick that keeps black/white from looking
  // pasted on.
  const darkInk: Oklch = { l: 0.17, c: Math.min(bg.c * 0.45, 0.05), h: bg.h };
  const lightInk: Oklch = { l: 0.985, c: Math.min(bg.c * 0.12, 0.015), h: bg.h };
  const light = contrast(oklchToHex(lightInk), bgHex) >= contrast(oklchToHex(darkInk), bgHex);
  const ink = light ? lightInk : darkInk;
  return {
    bgHex,
    light,
    ink: oklchToHex(ink),
    soft: oklchToHex({ ...ink, alpha: SOFT_ALPHA }),
  };
}

// ---------------------------------------------------------------------------
// WCAG 2 contrast, on hex. Alpha (`#rrggbbaa`) is composited over `under`.

function channels(hex: string): [number, number, number, number] {
  const value = hex.replace('#', '');
  const read = (i: number) => parseInt(value.slice(i, i + 2), 16) / 255;
  return [read(0), read(2), read(4), value.length >= 8 ? read(6) : 1];
}

/** `over` composited onto an opaque `under`, as opaque hex. */
export function composite(over: string, under: string): string {
  const [r, g, b, a] = channels(over);
  const [ur, ug, ub] = channels(under);
  const mix = (top: number, bottom: number) =>
    Math.round((top * a + bottom * (1 - a)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${mix(r, ur)}${mix(g, ug)}${mix(b, ub)}`;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. A translucent `fg` is composited onto `bg` first. */
export function contrast(fg: string, bg: string): number {
  const solid = composite(fg, bg);
  const a = luminance(solid);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The record ornament's groove: the block's ink at a whisper. Text that can
 * sit over it is always full ink, and the spec checks that pairing too.
 */
export function grooveOf(color: PosterColor): string {
  return composite(`${color.ink}1a`, color.bg);
}

/** A hairline in the block's ink — dividers only, never behind text. */
export function hairlineOf(color: PosterColor): string {
  return composite(`${color.ink}2e`, color.bg);
}

/** Skeleton bones in the block's ink. */
export function boneOf(color: PosterColor): string {
  return composite(`${color.ink}26`, color.bg);
}
