import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, useTokens } from '@/theme';
import { ThemedText } from './themed-text';

/**
 * A capsule for a count or a status word. Reads against whatever surface it
 * sits on: the quiet variant is the foreground at a low alpha, which is the
 * same trick the coloured-card formula uses, so it works on the canvas and on
 * every palette slot without a per-palette case.
 */
export function Badge({
  label,
  variant = 'muted',
  style,
}: {
  label: string;
  variant?: 'muted' | 'solid';
  style?: StyleProp<ViewStyle>;
}) {
  const tokens = useTokens();
  const solid = variant === 'solid';

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: solid ? tokens.primary : tokens.muted,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        },
        style,
      ]}
    >
      <ThemedText
        variant="footnote"
        style={{
          color: solid ? tokens.primaryForeground : tokens.foreground,
          fontWeight: '600',
        }}
      >
        {label}
      </ThemedText>
    </View>
  );
}
