import { createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_BOARD_THEME,
  type BoardPalette,
  type WidgetColor,
} from '@artist/shared';
import { useCardColors, useThemeColors, type ThemeColors } from './colors';

/**
 * React Native has no cascade, and the colour system depends on one.
 *
 * On the web a coloured card re-points `--card-foreground`, `--muted-foreground`
 * and the rest, and every element inside inherits legible colours without
 * knowing it is on a coloured card. That inheritance is the thing that keeps ten
 * widgets from being styled one by one — and it does not exist here. Threading
 * a colour down through every child would reintroduce exactly the per-widget
 * styling the CSS formula removed.
 *
 * So context stands in for the cascade: `Card` publishes its token set, and
 * anything below reads the nearest one. Outside a card that is the page's own
 * tokens, which is what the fallback does.
 */
const TokensContext = createContext<ThemeColors | null>(null);

export function ThemeTokensProvider({
  value,
  children,
}: {
  value: ThemeColors;
  children: ReactNode;
}) {
  return (
    <TokensContext.Provider value={value}>{children}</TokensContext.Provider>
  );
}

/** The nearest token set: a card's if inside one, otherwise the page's. */
export function useTokens(): ThemeColors {
  const fromCard = useContext(TokensContext);
  const page = useThemeColors();
  return fromCard ?? page;
}

/**
 * Which palette the board being shown uses. A card names a slot (`c1`–`c4`)
 * and the palette decides what that slot looks like, so the palette belongs to
 * the screen, not to each card.
 */
const PaletteContext = createContext<BoardPalette>(DEFAULT_BOARD_THEME.palette);

export function BoardPaletteProvider({
  palette,
  children,
}: {
  palette: BoardPalette;
  children: ReactNode;
}) {
  return (
    <PaletteContext.Provider value={palette}>
      {children}
    </PaletteContext.Provider>
  );
}

export function useBoardPalette(): BoardPalette {
  return useContext(PaletteContext);
}

/** The tokens for a slot in the board's palette. */
export function useSlotTokens(slot: WidgetColor): ThemeColors {
  return useCardColors(useBoardPalette(), slot);
}
