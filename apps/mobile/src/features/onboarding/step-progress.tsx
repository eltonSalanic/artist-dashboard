import { View } from 'react-native';
import { PosterText } from '@/components/poster-text';
import { spacing, usePosterCanvas } from '@/theme';

/** "2 of 3" over a segmented bar: how short the setup is, at a glance. */
export function StepProgress({ step, of }: { step: number; of: number }) {
  const canvas = usePosterCanvas();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${of}`}
      style={{ gap: spacing.sm }}
    >
      <PosterText variant="label" color={canvas.soft}>
        {`STEP ${step} OF ${of}`}
      </PosterText>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {Array.from({ length: of }, (_, index) => (
          <View
            key={index}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: canvas.ink,
              opacity: index < step ? 1 : 0.15,
            }}
          />
        ))}
      </View>
    </View>
  );
}
