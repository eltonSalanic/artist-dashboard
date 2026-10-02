import { Text, type TextProps } from 'react-native';
import { type, type TypeVariant } from '@/theme';
import { useTokens } from '@/theme';

/**
 * The only thing in the app that sets a font size or a text colour. Screens
 * pick a role (`headline`, `subhead`) and a tone; the tone resolves against the
 * nearest token set, so the same `<ThemedText>` reads correctly on the canvas
 * and on a coloured card without being told which it is on.
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

  return <Text style={[type[variant], { color: tones[tone] }, style]} {...props} />;
}
