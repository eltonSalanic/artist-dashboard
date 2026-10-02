/**
 * The colour values behind the board palettes, in one place both platforms can
 * read.
 *
 * `theme.ts` next door holds palette *metadata* — ids, labels, which slots a
 * palette fills — and deliberately held no colours, because the web app kept
 * them in `globals.css` where light/dark tuning lives naturally. Metro cannot
 * read CSS, so the values live here now.
 *
 * **`apps/web` still renders from its own CSS custom properties**, and that is
 * on purpose: regenerating a hand-tuned stylesheet is a web change, and a
 * mobile phase should not be making one. Instead
 * `apps/web/src/app/palette-tokens.test.ts` parses `globals.css` and asserts it
 * agrees with this file, declaration for declaration. Edit either side and that
 * test names the mismatch, which is the property that actually matters — the
 * two platforms cannot drift. If the duplication ever grates, the test is also
 * what makes generating the CSS from here a safe follow-up.
 */

import type { Oklch } from './colors';
import type { BoardPalette, PaletteSlot } from './theme';

export type ColorScheme = 'light' | 'dark';

/** A card's pair: what it is painted with, and what reads on top of it. */
export interface SlotColors {
  bg: Oklch;
  fg: Oklch;
}

/**
 * The shadcn token set, which both platforms name identically so a component
 * ported between them keeps its colours. Values are OKLCH; React Native gets
 * hex via `oklchToHex`.
 */
export interface ColorTokens {
  background: Oklch;
  foreground: Oklch;
  card: Oklch;
  cardForeground: Oklch;
  popover: Oklch;
  popoverForeground: Oklch;
  primary: Oklch;
  primaryForeground: Oklch;
  secondary: Oklch;
  secondaryForeground: Oklch;
  muted: Oklch;
  mutedForeground: Oklch;
  accent: Oklch;
  accentForeground: Oklch;
  destructive: Oklch;
  border: Oklch;
  input: Oklch;
  ring: Oklch;
}

/** The page itself — warm cream canvas, warm charcoal in the dark. */
export const SURFACE_TOKENS: Record<ColorScheme, ColorTokens> = {
  light: {
    background: { l: 0.928, c: 0.012, h: 84 },
    foreground: { l: 0.205, c: 0.006, h: 60 },
    card: { l: 0.972, c: 0.008, h: 85 },
    cardForeground: { l: 0.205, c: 0.006, h: 60 },
    popover: { l: 0.982, c: 0.007, h: 85 },
    popoverForeground: { l: 0.205, c: 0.006, h: 60 },
    primary: { l: 0.22, c: 0.006, h: 60 },
    primaryForeground: { l: 0.972, c: 0.01, h: 85 },
    secondary: { l: 0.9, c: 0.013, h: 84 },
    secondaryForeground: { l: 0.24, c: 0.006, h: 60 },
    muted: { l: 0.902, c: 0.012, h: 84 },
    mutedForeground: { l: 0.505, c: 0.012, h: 66 },
    accent: { l: 0.888, c: 0.014, h: 84 },
    accentForeground: { l: 0.24, c: 0.006, h: 60 },
    destructive: { l: 0.577, c: 0.21, h: 27.325 },
    border: { l: 0.858, c: 0.013, h: 84 },
    input: { l: 0.84, c: 0.013, h: 84 },
    ring: { l: 0.7, c: 0.03, h: 60 },
  },
  dark: {
    background: { l: 0.2, c: 0.006, h: 70 },
    foreground: { l: 0.95, c: 0.008, h: 85 },
    card: { l: 0.235, c: 0.006, h: 70 },
    cardForeground: { l: 0.95, c: 0.008, h: 85 },
    popover: { l: 0.245, c: 0.006, h: 70 },
    popoverForeground: { l: 0.95, c: 0.008, h: 85 },
    primary: { l: 0.92, c: 0.008, h: 85 },
    primaryForeground: { l: 0.22, c: 0.006, h: 70 },
    secondary: { l: 0.27, c: 0.006, h: 70 },
    secondaryForeground: { l: 0.95, c: 0.008, h: 85 },
    muted: { l: 0.27, c: 0.006, h: 70 },
    mutedForeground: { l: 0.71, c: 0.01, h: 75 },
    accent: { l: 0.29, c: 0.006, h: 70 },
    accentForeground: { l: 0.95, c: 0.008, h: 85 },
    destructive: { l: 0.62, c: 0.2, h: 25 },
    // The only translucent tokens: a white veil over whatever is beneath,
    // rather than a fixed grey, so it works on card and canvas alike.
    border: { l: 1, c: 0, h: 0, alpha: 0.12 },
    input: { l: 1, c: 0, h: 0, alpha: 0.16 },
    ring: { l: 0.55, c: 0.02, h: 70 },
  },
};

/**
 * The brand accents, which the `playful` palette is made of. Unlike the other
 * four palettes these retune *both* halves between light and dark, because the
 * tokens themselves do.
 */
export const BRAND_ACCENTS: Record<
  ColorScheme,
  Record<'coral' | 'lilac' | 'lime' | 'ink', SlotColors>
> = {
  light: {
    coral: { bg: { l: 0.63, c: 0.18, h: 32 }, fg: { l: 0.98, c: 0.012, h: 85 } },
    lilac: { bg: { l: 0.8, c: 0.09, h: 295 }, fg: { l: 0.28, c: 0.05, h: 295 } },
    lime: { bg: { l: 0.88, c: 0.185, h: 122 }, fg: { l: 0.32, c: 0.07, h: 122 } },
    ink: { bg: { l: 0.19, c: 0.004, h: 60 }, fg: { l: 0.965, c: 0.012, h: 85 } },
  },
  dark: {
    coral: { bg: { l: 0.62, c: 0.17, h: 32 }, fg: { l: 0.98, c: 0.012, h: 85 } },
    lilac: { bg: { l: 0.72, c: 0.09, h: 295 }, fg: { l: 0.22, c: 0.05, h: 295 } },
    lime: { bg: { l: 0.82, c: 0.17, h: 122 }, fg: { l: 0.26, c: 0.07, h: 122 } },
    ink: { bg: { l: 0.13, c: 0.004, h: 70 }, fg: { l: 0.95, c: 0.012, h: 85 } },
  },
};

/**
 * Every palette's four slots, light and dark.
 *
 * The weights alternate on purpose — pale tint, solid, tint, deep panel —
 * because that alternation, more than the hue, is what makes the grid read as
 * playful. Keep the rhythm if you add a palette.
 *
 * Only `playful` changes its foregrounds in the dark; the other four darken the
 * card and keep the same text colour, which is what the CSS does by overriding
 * `--wc-N` without touching `--wc-N-fg`.
 */
export const BOARD_PALETTE_COLORS: Record<
  BoardPalette,
  Record<ColorScheme, Record<PaletteSlot, SlotColors>>
> = {
  playful: {
    light: {
      c1: BRAND_ACCENTS.light.coral,
      c2: BRAND_ACCENTS.light.lilac,
      c3: BRAND_ACCENTS.light.lime,
      c4: BRAND_ACCENTS.light.ink,
    },
    dark: {
      c1: BRAND_ACCENTS.dark.coral,
      c2: BRAND_ACCENTS.dark.lilac,
      c3: BRAND_ACCENTS.dark.lime,
      c4: BRAND_ACCENTS.dark.ink,
    },
  },
  sunset: {
    light: {
      c1: { bg: { l: 0.84, c: 0.13, h: 78 }, fg: { l: 0.3, c: 0.06, h: 60 } },
      c2: { bg: { l: 0.53, c: 0.16, h: 28 }, fg: { l: 0.97, c: 0.02, h: 80 } },
      c3: { bg: { l: 0.82, c: 0.08, h: 12 }, fg: { l: 0.32, c: 0.08, h: 15 } },
      c4: { bg: { l: 0.3, c: 0.08, h: 340 }, fg: { l: 0.95, c: 0.02, h: 340 } },
    },
    dark: {
      c1: { bg: { l: 0.8, c: 0.13, h: 78 }, fg: { l: 0.3, c: 0.06, h: 60 } },
      c2: { bg: { l: 0.55, c: 0.16, h: 28 }, fg: { l: 0.97, c: 0.02, h: 80 } },
      c3: { bg: { l: 0.76, c: 0.08, h: 12 }, fg: { l: 0.32, c: 0.08, h: 15 } },
      c4: { bg: { l: 0.26, c: 0.07, h: 340 }, fg: { l: 0.95, c: 0.02, h: 340 } },
    },
  },
  ocean: {
    light: {
      c1: { bg: { l: 0.86, c: 0.07, h: 178 }, fg: { l: 0.3, c: 0.05, h: 190 } },
      c2: { bg: { l: 0.55, c: 0.1, h: 205 }, fg: { l: 0.97, c: 0.015, h: 200 } },
      c3: { bg: { l: 0.8, c: 0.08, h: 232 }, fg: { l: 0.28, c: 0.06, h: 245 } },
      c4: { bg: { l: 0.26, c: 0.06, h: 250 }, fg: { l: 0.94, c: 0.02, h: 235 } },
    },
    dark: {
      c1: { bg: { l: 0.8, c: 0.07, h: 178 }, fg: { l: 0.3, c: 0.05, h: 190 } },
      c2: { bg: { l: 0.52, c: 0.1, h: 205 }, fg: { l: 0.97, c: 0.015, h: 200 } },
      c3: { bg: { l: 0.74, c: 0.08, h: 232 }, fg: { l: 0.28, c: 0.06, h: 245 } },
      c4: { bg: { l: 0.22, c: 0.05, h: 250 }, fg: { l: 0.94, c: 0.02, h: 235 } },
    },
  },
  forest: {
    light: {
      c1: { bg: { l: 0.52, c: 0.1, h: 148 }, fg: { l: 0.97, c: 0.02, h: 120 } },
      c2: { bg: { l: 0.86, c: 0.05, h: 140 }, fg: { l: 0.3, c: 0.05, h: 145 } },
      c3: { bg: { l: 0.79, c: 0.1, h: 70 }, fg: { l: 0.3, c: 0.06, h: 60 } },
      c4: { bg: { l: 0.27, c: 0.035, h: 105 }, fg: { l: 0.95, c: 0.02, h: 110 } },
    },
    dark: {
      c1: { bg: { l: 0.5, c: 0.1, h: 148 }, fg: { l: 0.97, c: 0.02, h: 120 } },
      c2: { bg: { l: 0.8, c: 0.05, h: 140 }, fg: { l: 0.3, c: 0.05, h: 145 } },
      c3: { bg: { l: 0.74, c: 0.1, h: 70 }, fg: { l: 0.3, c: 0.06, h: 60 } },
      c4: { bg: { l: 0.2, c: 0.03, h: 105 }, fg: { l: 0.95, c: 0.02, h: 110 } },
    },
  },
  mono: {
    light: {
      c1: { bg: { l: 0.9, c: 0.008, h: 80 }, fg: { l: 0.28, c: 0.006, h: 70 } },
      c2: { bg: { l: 0.76, c: 0.008, h: 80 }, fg: { l: 0.24, c: 0.006, h: 70 } },
      c3: { bg: { l: 0.45, c: 0.008, h: 75 }, fg: { l: 0.96, c: 0.006, h: 85 } },
      c4: { bg: { l: 0.17, c: 0.005, h: 70 }, fg: { l: 0.95, c: 0.008, h: 85 } },
    },
    dark: {
      c1: { bg: { l: 0.84, c: 0.008, h: 80 }, fg: { l: 0.28, c: 0.006, h: 70 } },
      c2: { bg: { l: 0.66, c: 0.008, h: 80 }, fg: { l: 0.24, c: 0.006, h: 70 } },
      c3: { bg: { l: 0.42, c: 0.008, h: 75 }, fg: { l: 0.96, c: 0.006, h: 85 } },
      c4: { bg: { l: 0.12, c: 0.004, h: 70 }, fg: { l: 0.95, c: 0.008, h: 85 } },
    },
  },
};

/**
 * How much of the slot's foreground each derived token carries. The CSS says
 * the same thing as `color-mix(in oklab, var(--wc-fg) N%, transparent)`, which
 * for a mix with transparent is exactly "the foreground at N% alpha".
 *
 * These percentages sit between the two families the brand accents were tuned
 * for — solid panels and pale tints — so one formula serves every slot. If a
 * single slot ever reads badly, override that slot rather than moving these.
 */
export const SLOT_ALPHAS = {
  mutedForeground: 0.72,
  muted: 0.14,
  accent: 0.14,
  border: 0.2,
  input: 0.32,
  secondary: 0.16,
  ring: 0.4,
} as const;

/**
 * One formula for every coloured card: re-point the token set so anything
 * rendered inside inherits legible colours, instead of restyling ten widgets
 * one by one. The web app does this in CSS under `[data-wc]`; this is the same
 * arithmetic for React Native, which has no cascade to do it with.
 *
 * `background`, `popover` and `destructive` deliberately pass through — a card
 * does not own the page behind it, and a destructive action should look
 * destructive everywhere.
 */
export function slotTokens(slot: SlotColors, base: ColorTokens): ColorTokens {
  const veil = (alpha: number): Oklch => ({ ...slot.fg, alpha });
  return {
    ...base,
    card: slot.bg,
    cardForeground: slot.fg,
    foreground: slot.fg,
    primary: slot.fg,
    primaryForeground: slot.bg,
    accentForeground: slot.fg,
    secondaryForeground: slot.fg,
    mutedForeground: veil(SLOT_ALPHAS.mutedForeground),
    muted: veil(SLOT_ALPHAS.muted),
    accent: veil(SLOT_ALPHAS.accent),
    border: veil(SLOT_ALPHAS.border),
    input: veil(SLOT_ALPHAS.input),
    secondary: veil(SLOT_ALPHAS.secondary),
    ring: veil(SLOT_ALPHAS.ring),
  };
}
