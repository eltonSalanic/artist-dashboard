import type { ComponentProps } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { spacing, usePosterCanvas } from '@/theme';

type AnimatedViewStyle = ComponentProps<typeof Animated.View>['style'];

/** Optional styles for each part, so the welcome screen can bring them in one by one. */
export interface MastheadMotion {
  date?: AnimatedViewStyle;
  name?: AnimatedViewStyle;
  chevron?: AnimatedViewStyle;
}

/**
 * Today's date in small caps, then the band's name as big as it will go, with
 * a round button that says it opens something. Only the look: the hub wraps it
 * in the band switcher's link, and the welcome screen plays it in as the first
 * frame of its preview, so the two can't drift apart.
 */
export function MastheadTitle({ name, motion }: { name: string; motion?: MastheadMotion }) {
  const canvas = usePosterCanvas();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return (
    <>
      <Animated.View style={motion?.date}>
        <PosterText variant="label" color={canvas.soft}>
          {today.toUpperCase()}
        </PosterText>
      </Animated.View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Animated.View style={[{ flexShrink: 1 }, motion?.name]}>
          <PosterText
            variant="display"
            color={canvas.ink}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {name}
          </PosterText>
        </Animated.View>
        <Animated.View
          style={[
            {
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: canvas.ink,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
            },
            motion?.chevron,
          ]}
        >
          <Icon
            name={{ sf: 'chevron.down', md: 'expand-more' }}
            size={14}
            color={canvas.background}
          />
        </Animated.View>
      </View>
    </>
  );
}
