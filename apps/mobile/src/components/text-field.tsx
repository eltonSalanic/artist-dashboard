import { TextInput, View, type TextInputProps } from 'react-native';
import { radius, spacing, type, useTokens } from '@/theme';
import { ThemedText } from './themed-text';

/**
 * A labelled input. `TextInput` is the platform's own control, so this adds the
 * label, the token styling and the error slot and otherwise passes everything
 * through — keyboard type, autocomplete and the rest stay the caller's call.
 */
export function TextField({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  const tokens = useTokens();

  return (
    <View style={{ gap: spacing.xs }}>
      <ThemedText variant="footnote" tone="muted" style={{ fontWeight: '600' }}>
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={tokens.mutedForeground}
        style={[
          type.body,
          {
            color: tokens.foreground,
            backgroundColor: tokens.card,
            borderWidth: 1,
            borderColor: error ? tokens.destructive : tokens.border,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
          },
          style,
        ]}
        {...props}
      />
      {error != null && error !== '' && (
        <ThemedText variant="footnote" tone="destructive">
          {error}
        </ThemedText>
      )}
    </View>
  );
}
