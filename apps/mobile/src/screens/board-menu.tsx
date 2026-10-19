import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissions } from '@artist/api-client';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { requestHubEdit } from '@/features/board/hub-edit';
import { useSelectedBoard } from '@/features/board/selected-board';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * How long the push waits for this sheet to finish closing. On iOS a formSheet
 * that is still closing lays itself out once more and resizes the first scroll
 * view down its old views to the sheet's height; Fabric has already recycled
 * those views into the pushed screen, so Settings drew two members and then
 * blank space. react-native-screens#4651, fixed in 4.28 (Expo 57 pins 4.26);
 * drop the wait once the app is on a fixed version.
 */
const SHEET_CLOSE_MS = 350;

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
  const headerHeight = useHeaderHeight();
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
        : 'What this band may tell you about.',
      href: base ? `${base}/settings` : undefined,
      visible: true,
    },
  ];

  return (
    // A plain View: three rows never need to scroll, and a ScrollView here
    // made the clipping described at `SHEET_CLOSE_MS` worse.
    // The sheet's header is drawn over its content, hence the top padding:
    // without it the first row sat under the title.
    <View
      style={{
        backgroundColor: colors.background,
        padding: spacing.md,
        paddingTop: headerHeight + spacing.sm,
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
              else if (item.href) {
                const href = item.href;
                setTimeout(() => router.push(href), SHEET_CLOSE_MS);
              }
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
