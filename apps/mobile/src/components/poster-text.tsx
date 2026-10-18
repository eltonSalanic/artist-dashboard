import { useEffect, useRef, useState } from 'react';
import { Text, type TextProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
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

/** Ease-out cubic: fast off the mark, settling onto the number. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that counts up to `value` — on first show from zero, and after a
 * refresh from the number it was showing, so a change reads as a change.
 *
 * Driven from JS with `requestAnimationFrame` rather than on the UI thread:
 * Reanimated cannot animate the *content* of a `<Text>`, only its style, and
 * the TextInput workaround loses `adjustsFontSizeToFit`, which these numbers
 * rely on to fit their blocks. It is a few hundred milliseconds, once per
 * card per load, and only this `<Text>` re-renders.
 *
 * Reduce Motion shows the final number at once. So does a screen reader: the
 * label is always the real value, never a frame of the count.
 */
export function CountUp({
  value,
  delay = 0,
  duration = 700,
  ...props
}: Omit<React.ComponentProps<typeof PosterText>, 'children'> & {
  value: number;
  delay?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const shown = useRef(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const from = shown.current;
    if (reduced || from === value) return;
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const next = Math.round(from + (value - from) * easeOut(t));
      shown.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, delay, duration]);

  return (
    <PosterText accessibilityLabel={String(value)} {...props}>
      {reduced ? value : display}
    </PosterText>
  );
}
