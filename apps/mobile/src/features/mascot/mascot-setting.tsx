import { Pressable, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Mascot } from '@/components/mascot';
import { PosterText } from '@/components/poster-text';
import { face, posterRadius, spacing, usePosterCanvas } from '@/theme';
import { MASCOTS, useMascot } from './mascot-preference';

/**
 * The mascot picker on the You tab: dez or bunz, each waving its own head.
 * Set as the show status sheet's choices are, a radio row per option.
 */
export function MascotSetting() {
  const canvas = usePosterCanvas();
  const { mascot, setMascot } = useMascot();

  return (
    <View accessibilityRole="radiogroup" style={{ gap: spacing.xs }}>
      {MASCOTS.map((name) => {
        const selected = name === mascot;
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ selected }}
            onPress={() => setMascot(name)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              minHeight: 52,
              paddingHorizontal: spacing.sm + 4,
              borderRadius: posterRadius.block,
              borderCurve: 'continuous',
              backgroundColor: selected || pressed ? canvas.faint : 'transparent',
            })}
          >
            <Mascot name={name} pose="icon" width={36} accessibilityLabel="" />
            <PosterText
              variant="rowTitle"
              color={canvas.ink}
              style={[{ flex: 1 }, selected && { fontFamily: face.heavy }]}
            >
              {name}
            </PosterText>
            <View style={{ width: 22, alignItems: 'center' }}>
              {selected && (
                <Icon name={{ sf: 'checkmark', md: 'check' }} size={17} color={canvas.ink} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
