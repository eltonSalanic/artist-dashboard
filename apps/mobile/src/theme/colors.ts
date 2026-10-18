import { useColorScheme } from 'react-native';
import {
  BOARD_PALETTE_COLORS,
  SURFACE_TOKENS,
  oklchToHex,
  slotTokens,
  type BoardPalette,
  type ColorScheme,
  type ColorTokens,
  type WidgetColor,
} from '@artist/shared';

/**
 * Colour tokens, resolved to hex for React Native.
 *
 * The `expo-design-system` skill's default is to build a palette out of
 * platform semantic colours (`Color.ios.systemBackground` and friends) and add
 * brand pairs only where the brand needs values the platform does not provide.
 * Here that exception is the whole palette: the product's identity is a warm
 * cream canvas with five selectable board palettes, and a board has to look the
 * same on a phone as it does in a browser. `systemBackground` would be a
 * different app. So every value comes from `@artist/shared`, which the web
 * app's stylesheet is tested against.
 *
 * These are light/dark **pairs**, which makes them hook-only in the skill's
 * sense: a static token file cannot read them. That is why `typography.ts`
 * carries no colour and `ThemedText` applies it at render time.
 */
export type ThemeColors = Readonly<Record<keyof ColorTokens, string>>;

function toHex(tokens: ColorTokens): ThemeColors {
  const out = {} as Record<keyof ColorTokens, string>;
  for (const [name, value] of Object.entries(tokens)) {
    out[name as keyof ColorTokens] = oklchToHex(value);
  }
  return out;
}

/** The page's own tokens. Two schemes, converted once at import. */
const surfaces: Record<ColorScheme, ThemeColors> = {
  light: toHex(SURFACE_TOKENS.light),
  dark: toHex(SURFACE_TOKENS.dark),
};

/**
 * Coloured-card token sets, built on first use and kept.
 *
 * Eagerly converting all of them would be 5 palettes × 2 schemes × 4 slots ×
 * 18 tokens of trigonometry at startup, to paint the two or three slots one
 * board actually uses.
 */
const slotCache = new Map<string, ThemeColors>();

/**
 * A card's tokens for one slot of a palette. A plain function so a list
 * painting several bands (the calendar) can call it per row; one band's
 * screen uses `useCardColors`.
 */
export function cardTokens(
  palette: BoardPalette,
  scheme: ColorScheme,
  slot: WidgetColor,
): ThemeColors {
  if (slot === 'base') return surfaces[scheme];

  const key = `${palette}:${scheme}:${slot}`;
  const cached = slotCache.get(key);
  if (cached) return cached;

  const resolved = toHex(
    slotTokens(BOARD_PALETTE_COLORS[palette][scheme][slot], SURFACE_TOKENS[scheme]),
  );
  slotCache.set(key, resolved);
  return resolved;
}

/**
 * The scheme to paint with. Follows the OS; unlike the web app there is no
 * in-app override yet, because the phone's own setting is where people expect
 * to find it.
 */
export function useScheme(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** The page's tokens for the current scheme. */
export function useThemeColors(): ThemeColors {
  return surfaces[useScheme()];
}

/**
 * The tokens a card paints with, which is the whole point of the shared
 * palettes: a widget names a slot, never a colour, and the board's palette
 * decides what that slot looks like.
 */
export function useCardColors(
  palette: BoardPalette,
  slot: WidgetColor,
): ThemeColors {
  return cardTokens(palette, useScheme(), slot);
}

/**
 * A band's own colour, for a list that has to tell several of them apart.
 *
 * The first slot of the board's palette — the colour the board itself leads
 * with when you open it, which is what makes the dot learnable rather than
 * arbitrary. Two bands on the same palette therefore look alike, and that is
 * honest: the dot says what a board looks like, it does not claim to identify
 * it. Every row names its band in words as well, so nothing is carried by
 * colour alone.
 *
 * A plain function taking the scheme, not a hook, because the callers paint a
 * *list* of boards: a hook would be called a different number of times as
 * membership changed. The caller reads `useScheme()` once and spends it here.
 */
export interface SlotHex {
  bg: string;
  fg: string;
}

const accentCache = new Map<string, SlotHex>();

export function boardAccent(
  palette: BoardPalette,
  scheme: ColorScheme,
): SlotHex {
  const key = `${palette}:${scheme}`;
  const cached = accentCache.get(key);
  if (cached) return cached;

  const { bg, fg } = BOARD_PALETTE_COLORS[palette][scheme].c1;
  const resolved = { bg: oklchToHex(bg), fg: oklchToHex(fg) };
  accentCache.set(key, resolved);
  return resolved;
}

/**
 * A palette's four card colours, as hex — what the palette picker previews.
 * Same conversion and the same caching reason as `boardAccent`.
 */
const swatchCache = new Map<string, string[]>();

export function paletteSwatches(palette: BoardPalette, scheme: ColorScheme): string[] {
  const key = `${palette}:${scheme}`;
  const cached = swatchCache.get(key);
  if (cached) return cached;

  const slots = BOARD_PALETTE_COLORS[palette][scheme];
  const resolved = (['c1', 'c2', 'c3', 'c4'] as const).map((slot) =>
    oklchToHex(slots[slot].bg),
  );
  swatchCache.set(key, resolved);
  return resolved;
}
