import { Pressable, ScrollView, View } from 'react-native';
import { usePermissions } from '@artist/api-client';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * The hub's `⋯`: the things that are not widgets. A sheet rather than an iOS
 * header menu (`Stack.Toolbar.Menu`), which is iOS-only — one implementation
 * both platforms get is worth more here than the platform-perfect menu on half
 * of them, and the sheet has room for a line of explanation.
 */
export function BoardMenuSheet() {
  const colors = useThemeColors();
  const { can } = usePermissions();

  const items: {
    icon: IconName;
    title: string;
    body: string;
    phase: string;
    visible: boolean;
  }[] = [
    {
      icon: { sf: 'square.grid.2x2', md: 'dashboard-customize' },
      title: 'Manage widgets',
      body: 'Choose which cards you see and in what order.',
      phase: 'P12',
      visible: true,
    },
    {
      icon: { sf: 'archivebox', md: 'archive' },
      title: 'Archive',
      body: 'Anything put away, and a way to bring it back.',
      phase: 'P10',
      visible: can('archive.view'),
    },
    {
      icon: { sf: 'slider.horizontal.3', md: 'tune' },
      title: 'Board settings',
      body: 'Name, palette, statuses and members.',
      phase: 'P10',
      visible: can('board.appearance'),
    },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
    >
      {items
        .filter((item) => item.visible)
        .map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            // Nothing to navigate to yet; the phase that builds each screen
            // wires it up. Left non-interactive rather than opening a dead end.
            disabled
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: colors.card,
              opacity: 0.6,
            }}
          >
            <Icon name={item.icon} size={22} color={colors.mutedForeground} />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="headline">{item.title}</ThemedText>
              <ThemedText variant="footnote" tone="muted">
                {item.body}
              </ThemedText>
            </View>
            <ThemedText variant="caption" tone="muted">
              {item.phase}
            </ThemedText>
          </Pressable>
        ))}
    </ScrollView>
  );
}
