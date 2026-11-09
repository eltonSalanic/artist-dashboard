import { SURFACE_TOKENS, type ColorScheme, type ColorTokens } from '@artist/shared';

/**
 * The phone app's page tokens. Light is the shared warm cream, exactly as the
 * web app has it. Dark is true black rather than the shared warm charcoal:
 * the canvas is pure black (it disappears into an OLED screen's bezel), and
 * cards, sheets and fills are near-black lifts off it, just enough to keep
 * their edges, with the text and accent colours unchanged.
 */
export const SURFACES: Record<ColorScheme, ColorTokens> = {
  light: SURFACE_TOKENS.light,
  dark: {
    ...SURFACE_TOKENS.dark,
    background: { l: 0, c: 0, h: 0 },
    card: { l: 0.17, c: 0.003, h: 70 },
    popover: { l: 0.19, c: 0.003, h: 70 },
    primaryForeground: { l: 0, c: 0, h: 0 },
    secondary: { l: 0.215, c: 0.003, h: 70 },
    muted: { l: 0.215, c: 0.003, h: 70 },
    accent: { l: 0.24, c: 0.003, h: 70 },
  },
};
