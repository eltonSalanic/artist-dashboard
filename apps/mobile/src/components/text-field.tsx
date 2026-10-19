import { TextInput, View, type TextInputProps } from 'react-native';
import { posterInput, posterRadius, spacing, useTokens } from '@/theme';
import { FieldLabel } from './field-label';
import { PosterText } from './poster-text';

/**
 * A labelled input. `TextInput` is the platform's own control, so this adds the
 * label, the token styling and the error slot and otherwise passes everything
 * through — keyboard type, autocomplete and the rest stay the caller's call.
 *
 * A flat filled field with no outline, like Spotify's search box: on the
 * poster screens a hairline box reads as a form from another app. The border
 * is always there, transparent, so an error can colour it without the field
 * shifting by a pixel.
 */
export function TextField({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  const tokens = useTokens();
  const failed = error != null && error !== '';

  return (
    <View style={{ gap: spacing.xs + 2 }}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={tokens.mutedForeground}
        style={[
          posterInput,
          {
            color: tokens.foreground,
            backgroundColor: tokens.muted,
            borderWidth: 1.5,
            borderColor: failed ? tokens.destructive : 'transparent',
            borderRadius: posterRadius.block,
            borderCurve: 'continuous',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 5,
          },
          style,
        ]}
        {...props}
      />
      {failed && (
        <PosterText variant="meta" color={tokens.destructive}>
          {error}
        </PosterText>
      )}
    </View>
  );
}
