import { View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { spacing, useThemeColors } from '@/theme';

/**
 * A tab that exists so the navigation is real, saying plainly what will live
 * here and when. The alternative — leaving the tab out until its phase — would
 * mean the bottom bar changing shape twice more, and tabs cannot be added at
 * runtime without remounting the navigator and losing state.
 */
export function ComingSoonScreen({
  icon,
  title,
  body,
  phase,
}: {
  icon: IconName;
  title: string;
  body: string;
  phase: string;
}) {
  const colors = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          padding: spacing.xl,
        }}
      >
        <Icon name={icon} size={36} color={colors.mutedForeground} />
        <ThemedText variant="title">{title}</ThemedText>
        <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
          {body}
        </ThemedText>
        <ThemedText variant="caption" tone="muted">
          {phase}
        </ThemedText>
      </View>
    </View>
  );
}
