import { useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { MASCOT_LOTTIE, type MascotName, type MascotPose } from '../../assets/mascots/lottie';
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
  const source = dark ?? poses[pose as string];
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
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `${name}, the Band Wall mascot`}
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
