import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, useTokens } from '@/theme';
import { ThemedText } from './themed-text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md';

/**
 * Variants resolve against the nearest token set, so a primary button is
 * legible on the canvas and on any palette slot — on a coloured card `primary`
 * is the card's foreground and `primaryForeground` is the card itself, which is
 * the inversion the web formula performs.
 *
 * `style` merges last so a caller can change layout (margins, flex) without
 * forking the component. A caller reaching for colours means the variant set is
 * missing one.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  style,
}: {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const tokens = useTokens();

  const palette: Record<ButtonVariant, { background: string; label: string }> = {
    primary: { background: tokens.primary, label: tokens.primaryForeground },
    secondary: { background: tokens.secondary, label: tokens.foreground },
    ghost: { background: 'transparent', label: tokens.primary },
    destructive: { background: 'transparent', label: tokens.destructive },
  };
  const sizes: Record<ButtonSize, ViewStyle> = {
    sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
    md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  };

  const inactive = disabled || loading;
  const { background, label } = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      // Kept even while loading: replacing the text with a spinner would
      // otherwise leave the control unnamed to a screen reader.
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          borderWidth: variant === 'destructive' ? 1 : 0,
          borderColor: tokens.border,
          alignItems: 'center',
          justifyContent: 'center',
          // 44pt is the smallest comfortable touch target.
          minHeight: 48,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          ...sizes[size],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={label} />
      ) : (
        <ThemedText variant="headline" style={{ color: label }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}
