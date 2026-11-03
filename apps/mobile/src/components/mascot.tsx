import { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { MASCOT_LOTTIE, type MascotName, type MascotPose } from '../../assets/mascots/lottie';
import { MONTH_LETTERING, PHRASE_LETTERING } from '../../assets/mascots/lottie/lettering';
import { useMascot } from '@/features/mascot/mascot-preference';
import { useScheme } from '@/theme';

export type { MascotName, MascotPose };
/** The poses both characters have, so a screen can ask for one without knowing who. */
export type SharedPose = MascotPose<'dez'> & MascotPose<'bunz'>;

/**
 * One of the Band Wall mascots, looping its hand-drawn boil.
 *
 * The animations are generated from the SVGs in `assets/mascots/src` by
 * `npm run mascots`. Height follows the animation's own aspect ratio, so a
 * caller only sets the width. With Reduce Motion on, it holds the first frame.
 *
 * The ink is near-black, so on the dark theme a pose plays its twin drawn in
 * white (`heroDark` for `hero`) when it has one.
 */
export function Mascot<N extends MascotName>({
  name,
  pose = 'hero' as MascotPose<N>,
  width = 160,
  playing = true,
  style,
  accessibilityLabel,
}: {
  name: N;
  pose?: MascotPose<N>;
  width?: number;
  /** False holds the first frame. */
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const poses = MASCOT_LOTTIE[name] as Record<string, AnimationObject>;
  const dark = useScheme() === 'dark' ? poses[`${String(pose)}Dark`] : undefined;
  return (
    <Boil
      source={dark ?? poses[pose as string]}
      width={width}
      playing={playing}
      style={style}
      accessibilityLabel={accessibilityLabel ?? `${name}, the Band Wall mascot`}
    />
  );
}

/** Lettering is drawn to one size; this keeps it that size on every screen. */
const LETTERING_SCALE = 0.9;

/**
 * "NOTHING IN <MONTH>." in the mascots' own hand lettering, drawn per month by
 * `npm run mascots` (`scripts/month-lettering.mjs`) to match the "NO GIGS YET."
 * in the `empty` pose. `month` is 0 for January.
 */
export function MonthLettering({ month, monthName }: { month: number; monthName: string }) {
  return <Lettering pair={MONTH_LETTERING[month]} label={`Nothing in ${monthName}.`} />;
}

/** One of the other lines `scripts/month-lettering.mjs` letters, like "NOTHING FOR YOU.". */
export function PhraseLettering({
  phrase,
  label,
}: {
  phrase: keyof typeof PHRASE_LETTERING;
  /** For the screen reader, which can't read the drawing. */
  label: string;
}) {
  return <Lettering pair={PHRASE_LETTERING[phrase]} label={label} />;
}

function Lettering({ pair, label }: { pair: readonly [unknown, unknown]; label: string }) {
  const [light, dark] = pair as unknown as [AnimationObject, AnimationObject];
  const source = useScheme() === 'dark' ? dark : light;
  return (
    <Boil
      source={source}
      width={source.w * LETTERING_SCALE}
      accessibilityRole="header"
      accessibilityLabel={label}
    />
  );
}

/**
 * Plays a boiling drawing on loop. Height follows the animation's own aspect
 * ratio. With Reduce Motion on, or `playing` false, it holds the first frame.
 */
function Boil({
  source,
  width,
  playing = true,
  style,
  accessibilityRole = 'image',
  accessibilityLabel,
}: {
  source: AnimationObject;
  width: number;
  playing?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: 'image' | 'header';
  accessibilityLabel: string;
}) {
  const ref = useRef<LottieView>(null);
  const reduceMotion = useReducedMotion();
  const animate = playing && !reduceMotion;
  const height = (width * source.h) / source.w;

  useEffect(() => {
    if (animate) ref.current?.play();
    else ref.current?.reset(); // back to the first frame, stopped
  }, [animate, source]);

  // LottieView takes no accessibility props, so the wrapper carries them.
  return (
    <View
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[{ width, height }, style]}
    >
      <LottieView
        ref={ref}
        source={source}
        autoPlay={animate}
        loop
        resizeMode="contain"
        style={{ width, height }}
      />
    </View>
  );
}

/**
 * The mascot this phone picked on the You tab (dez until it picks). Screens
 * render this rather than `Mascot`, so a change of mind shows everywhere.
 */
export function MyMascot({
  pose,
  ...rest
}: { pose: SharedPose } & Omit<Parameters<typeof Mascot>[0], 'name' | 'pose'>) {
  const { mascot } = useMascot();
  return <Mascot name={mascot} pose={pose} {...rest} />;
}
