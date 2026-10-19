import { Text, type TextProps } from 'react-native';
import { BODY_SCALE, uiText, useTokens, type TypeVariant } from '@/theme';

/**
 * Text that takes its colour from the nearest token set. Screens pick a role
 * (`headline`, `subhead`) and a tone; the tone resolves against the nearest
 * token set, so the same `<ThemedText>` reads correctly on the canvas and on a
 * coloured card without being told which it is on.
 *
 * Set in Figtree (`uiText`), like `PosterText`: the roles are Apple's sizes,
 * the face is the app's. Never pass `fontWeight` in `style` — pick the role, or
 * a `fontFamily` from `face`; a weight on a custom face makes iOS fake it.
 */
export type TextTone = 'default' | 'muted' | 'destructive' | 'accent';

export function ThemedText({
  variant = 'body',
  tone = 'default',
  style,
  ...props
}: TextProps & { variant?: TypeVariant; tone?: TextTone }) {
  const tokens = useTokens();
  const tones: Record<TextTone, string> = {
    default: tokens.foreground,
    muted: tokens.mutedForeground,
    destructive: tokens.destructive,
    accent: tokens.primary,
  };

  return (
    <Text
      maxFontSizeMultiplier={BODY_SCALE}
      style={[uiText[variant], { color: tones[tone] }, style]}
      {...props}
    />
  );
}
