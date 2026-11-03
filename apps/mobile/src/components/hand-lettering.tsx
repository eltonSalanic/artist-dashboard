import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { DISPLAY_SCALE, face } from '@/theme';

/**
 * Three slightly different placings, swapped every 120ms: the same boil the
 * mascot drawings loop through (`scripts/svg-to-lottie.mjs`), so the words
 * wobble with the character they sit over.
 */
const BOIL = [
  [{ rotate: '-1deg' }, { translateY: 0 }],
  [{ rotate: '0.6deg' }, { translateY: -1 }],
  [{ rotate: '-0.2deg' }, { translateY: 1 }],
] as const;
const FRAME_MS = 120;

/**
 * Words in the mascots' hand lettering (thin capitals in a marker), for a
 * line the app has to fill in itself, like the month on an empty calendar.
 * Reduce Motion holds it still.
 */
export function HandLettering({
  children,
  color,
  size = 30,
  style,
}: {
  children: string;
  color: string;
  size?: number;
  style?: StyleProp<TextStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % BOIL.length), FRAME_MS);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <Text
      accessibilityRole="header"
      maxFontSizeMultiplier={DISPLAY_SCALE}
      style={[
        {
          fontFamily: face.hand,
          fontSize: size,
          lineHeight: size * 1.3,
          letterSpacing: size * 0.04,
          textTransform: 'uppercase',
          textAlign: 'center',
          color,
          transform: reduceMotion ? [] : [...BOIL[frame]],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
