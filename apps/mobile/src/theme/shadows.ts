import type { ColorScheme } from '@artist/shared';
import { useScheme } from './colors';

/**
 * `boxShadow` strings, not the legacy `shadowOffset`/`elevation` props — those
 * are two different APIs that need writing twice and still disagree.
 *
 * Three levels is enough. The canvas is a warm cream, so shadows stay soft:
 * a hard black drop on that background reads as a web page.
 *
 * **In the dark a shadow is a black drop on charcoal and shows nothing.** A
 * plain card is one step off the page, and each palette's deepest colour (the
 * playful ink, forest's bark) is darker than the page itself, so both lost
 * their edges. Dark elevation is the web's answer instead: a 1px ring of the
 * page ink at 10% (`ring-1 ring-foreground/10` on every web card), drawn inset
 * so it moves nothing, on every card and block whether coloured or not.
 */
export interface Shadows {
  card: string;
  raised: string;
  overlay: string;
  /**
   * For a surface that has no shadow in the light (a coloured calendar block,
   * a palette swatch): nothing on cream, the ring in the dark.
   */
  edge: string | undefined;
}

const RING = 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)';

const SHADOWS: Record<ColorScheme, Shadows> = {
  light: {
    card: '0 1px 2px rgba(0, 0, 0, 0.05)',
    raised: '0 4px 12px rgba(0, 0, 0, 0.10)',
    overlay: '0 8px 24px rgba(0, 0, 0, 0.18)',
    edge: undefined,
  },
  dark: {
    card: RING,
    raised: `0 4px 12px rgba(0, 0, 0, 0.35), ${RING}`,
    overlay: `0 8px 24px rgba(0, 0, 0, 0.5), ${RING}`,
    edge: RING,
  },
};

/** The elevation set for the current scheme. */
export function useShadows(): Shadows {
  return SHADOWS[useScheme()];
}
