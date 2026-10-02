import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { WidgetColor } from '@artist/shared';
import {
  ThemeTokensProvider,
  radius,
  shadows,
  spacing,
  useSlotTokens,
} from '@/theme';

/**
 * A surface painted with one slot of the board's palette. `base` is the
 * neutral card; `c1`–`c4` are the palette's colours.
 *
 * Takes `children` rather than content props on purpose — a card with a title,
 * a subtitle, an icon and a badge prop ends up re-exposing every internal
 * style. What it owns is the surface: padding, corner, elevation, and the token
 * set everything inside inherits.
 */
export function Card({
  slot = 'base',
  style,
  children,
}: {
  slot?: WidgetColor;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const tokens = useSlotTokens(slot);

  return (
    <ThemeTokensProvider value={tokens}>
      <View
        style={[
          {
            backgroundColor: tokens.card,
            borderRadius: radius.lg,
            // The squircle iOS actually draws. A circular arc at this radius
            // reads as subtly wrong next to native chrome.
            borderCurve: 'continuous',
            padding: spacing.md,
            gap: spacing.xs,
            boxShadow: shadows.card,
          },
          style,
        ]}
      >
        {children}
      </View>
    </ThemeTokensProvider>
  );
}
