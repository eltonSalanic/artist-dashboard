import { ActivityIndicator, Pressable } from 'react-native';
import { PosterText } from '@/components/poster-text';
import { posterRadius, spacing } from '@/theme';

/**
 * A capsule button for a screen painted in a band's colour, where the app's
 * own `Button` tokens don't apply: filled in the block's ink, or outlined.
 */
export function InkButton({
  title,
  ink,
  bg,
  outline = false,
  loading = false,
  disabled = false,
  onPress,
}: {
  title: string;
  /** The block's ink: the fill, or the outline and label. */
  ink: string;
  /** The block itself: the label on a filled button. */
  bg: string;
  outline?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        paddingHorizontal: spacing.lg,
        borderRadius: posterRadius.chip,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: outline ? 'transparent' : ink,
        borderWidth: outline ? 1.5 : 0,
        borderColor: ink,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={outline ? ink : bg} />
      ) : (
        <PosterText variant="caption" color={outline ? ink : bg}>
          {title}
        </PosterText>
      )}
    </Pressable>
  );
}
