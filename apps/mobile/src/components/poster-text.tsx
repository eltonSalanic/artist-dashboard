import { Text, type TextProps } from 'react-native';
import { BODY_SCALE, DISPLAY_SCALE, poster } from '@/theme';

export type PosterVariant = keyof typeof poster;

const DISPLAY: readonly PosterVariant[] = ['mega', 'figure', 'display', 'statement'];

/**
 * Text on the Wrapped screens. Unlike `ThemedText` it takes its colour
 * explicitly: a poster's ink is picked per block (`PosterColor.ink`), so there
 * is no "nearest token set" to inherit from — and being made to pass it means
 * no text lands on a block in a colour nobody checked.
 *
 * Display sizes cap their Dynamic Type growth harder than body sizes, so a
 * 96pt numeral cannot outgrow its block while the sentences under it still
 * scale for people who need them to.
 */
export function PosterText({
  variant,
  color,
  style,
  ...props
}: TextProps & { variant: PosterVariant; color: string }) {
  return (
    <Text
      maxFontSizeMultiplier={DISPLAY.includes(variant) ? DISPLAY_SCALE : BODY_SCALE}
      {...props}
      style={[poster[variant], { color }, style]}
    />
  );
}
