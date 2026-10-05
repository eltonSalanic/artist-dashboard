import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissions } from '@artist/api-client';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { requestHubEdit } from '@/features/board/hub-edit';
import { useSelectedBoard } from '@/features/board/selected-board';
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
  const { board } = useSelectedBoard();
  const insets = useSafeAreaInsets();
  const base = board ? `/board/${board.id}` : null;

  const items: {
    icon: IconName;
    title: string;
    body: string;
    /** Absent until the phase that builds the screen. */
    href?: string;
    /** Instead of a screen: something the hub underneath does. */
    action?: () => void;
    phase?: string;
    visible: boolean;
  }[] = [
    {
      icon: { sf: 'square.grid.2x2', md: 'dashboard-customize' },
      title: 'Edit widgets',
      body: 'Move, resize and hide the cards on your phone. You can also hold any card.',
      action: base ? requestHubEdit : undefined,
      visible: true,
    },
    {
      icon: { sf: 'archivebox', md: 'archive' },
      title: 'Archive',
      body: 'Anything put away, and a way to bring it back.',
      href: base ? `${base}/archive` : undefined,
      visible: can('archive.view'),
    },
    {
      icon: { sf: 'slider.horizontal.3', md: 'tune' },
      title: 'Settings',
      // Notifications are personal, so everyone gets this; what is inside
      // depends on the role.
      body: can('member.invite')
        ? 'Members, invites, statuses and palette, plus your notifications.'
        : 'What this band may email you about.',
      href: base ? `${base}/settings` : undefined,
      visible: true,
    },
  ];

  return (
    // A plain View, not a ScrollView, on purpose. Every row here dismisses
    // this sheet and pushes a screen in the same action, and on iOS a sheet
    // that holds a ScrollView then clips the pushed screen's scroll view to
    // the sheet's height: half of Settings drawn, the rest black, and later
    // screens can inherit it until a restart. react-native-screens#4651, fixed
    // upstream after 4.28.0; three rows never needed to scroll anyway.
    <View
      style={{
        backgroundColor: colors.background,
        padding: spacing.md,
        paddingBottom: spacing.md + insets.bottom,
        gap: spacing.xs,
      }}
    >
      {items
        .filter((item) => item.visible)
        .map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            // Without a screen yet, left non-interactive rather than opening a
            // dead end.
            disabled={!item.href && !item.action}
            onPress={() => {
              // Close the sheet first, so the screen pushes onto the stack
              // underneath instead of on top of a sheet.
              router.dismiss();
              if (item.action) item.action();
              else if (item.href) router.push(item.href);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: radius.md,
              borderCurve: 'continuous',
              backgroundColor: pressed ? colors.accent : colors.card,
              opacity: item.href || item.action ? 1 : 0.6,
            })}
          >
            <Icon
              name={item.icon}
              size={22}
              color={item.href || item.action ? colors.foreground : colors.mutedForeground}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText variant="headline">{item.title}</ThemedText>
              <ThemedText variant="footnote" tone="muted">
                {item.body}
              </ThemedText>
            </View>
            {item.phase ? (
              <ThemedText variant="caption" tone="muted">
                {item.phase}
              </ThemedText>
            ) : (
              <Icon
                name={{ sf: 'chevron.right', md: 'chevron-right' }}
                size={14}
                color={colors.mutedForeground}
              />
            )}
          </Pressable>
        ))}
    </View>
  );
}
