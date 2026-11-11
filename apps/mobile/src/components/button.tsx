import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { posterRadius, spacing, useTokens } from '@/theme';
import { PosterText } from './poster-text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md';

/** Every size's height: a capsule, so its corner radius is half of this. */
export const BUTTON_HEIGHT = 48;

/**
 * Variants resolve against the nearest token set, so a primary button is
 * legible on the canvas and on any palette slot — on a coloured card `primary`
 * is the card's foreground and `primaryForeground` is the card itself, which is
 * the inversion the web formula performs.
 *
 * `style` merges last so a caller can change layout (margins, flex) without
 * forking the component. A caller reaching for colours means the variant set is
 * missing one.
 *
 * Shaped like Spotify's buttons: a full capsule, a bold label.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  style,
  icon,
}: {
  title: string;
  /** Drawn before the label, e.g. a provider's logo. */
  icon?: ReactNode;
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
          borderRadius: posterRadius.chip,
          borderCurve: 'continuous',
          borderWidth: variant === 'destructive' ? 1 : 0,
          borderColor: tokens.border,
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          // 44pt is the smallest comfortable touch target.
          minHeight: BUTTON_HEIGHT,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          ...sizes[size],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={label} />
      ) : (
        <>
          {icon}
          <PosterText variant="caption" color={label}>
            {title}
          </PosterText>
        </>
      )}
    </Pressable>
  );
}
