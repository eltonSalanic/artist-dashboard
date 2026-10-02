import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { motion, radius, useTokens } from '@/theme';

/**
 * A placeholder with the shape of the thing that is coming.
 *
 * It pulses rather than sitting still, and it is not a spinner: a full-screen
 * spinner between every state is one of the named native-slop tells, and a
 * skeleton that holds the eventual layout stops the screen jumping when data
 * lands.
 *
 * Runs on the UI thread via Reanimated, so it keeps animating while JavaScript
 * is busy parsing the response it is waiting for — which is exactly when a
 * JS-driven animation stutters.
 */
export function Skeleton({
  width,
  height = 16,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const tokens = useTokens();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: motion.slow }),
      -1,
      true,
    );
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        {
          width: width ?? '100%',
          height,
          borderRadius: radius.sm,
          borderCurve: 'continuous',
          backgroundColor: tokens.muted,
        },
        animated,
        style,
      ]}
    />
  );
}
