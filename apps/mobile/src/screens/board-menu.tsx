import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissions } from '@artist/api-client';
import { Icon, type IconName } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { requestHubEdit } from '@/features/board/hub-edit';
import { useSelectedBoard } from '@/features/board/selected-board';
import { boardAccent, posterRadius, spacing, usePosterCanvas, useScheme } from '@/theme';

/**
 * The hub's `⋯`: the things that are not widgets. A sheet rather than an iOS
 * header menu (`Stack.Toolbar.Menu`), which is iOS-only — one implementation
 * both platforms get is worth more here than the platform-perfect menu on half
 * of them, and the sheet has room for a line of explanation.
 *
 * Set like Spotify's `⋯` menu: what it acts on first (the band, as a small tile
 * in its colour), then bare rows of an icon and a line, with no box round each.
 */
export function BoardMenuSheet() {
  const canvas = usePosterCanvas();
  const scheme = useScheme();
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
    // A plain View: three rows never need to scroll.
    // The sheet's header is drawn over its content, hence the top padding:
    // without it the first row sat under the title.
    <View
      style={{
        backgroundColor: canvas.background,
        padding: spacing.md,
        paddingTop: headerHeight + spacing.sm,
        paddingBottom: spacing.md + insets.bottom,
        gap: spacing.xs,
      }}
    >
      {board && <BandHeader name={board.name} accent={boardAccent(board.palette, scheme)} />}

      {items
        .filter((item) => item.visible)
        .map((item) => {
          const live = Boolean(item.href || item.action);
          return (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityHint={item.body}
              // Without a screen yet, left non-interactive rather than opening
              // a dead end.
              disabled={!live}
              onPress={() => {
                // Close the sheet first, so the screen pushes onto the stack
                // underneath instead of on top of a sheet. Both in one action
                // needs react-native-screens 4.29+: before it, the closing
                // sheet shrank the pushed screen's scroll view to the sheet's
                // height (react-native-screens#4651), cutting Settings off
                // after two members.
                router.dismiss();
                if (item.action) item.action();
                else if (item.href) router.push(item.href);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 56,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.sm,
                borderRadius: posterRadius.block,
                borderCurve: 'continuous',
                backgroundColor: pressed ? canvas.faint : 'transparent',
                opacity: live ? 1 : 0.5,
              })}
            >
              <Icon name={item.icon} size={24} color={canvas.ink} />
              <View style={{ flex: 1, gap: 2 }}>
                <PosterText variant="rowTitle" color={canvas.ink}>
                  {item.title}
                </PosterText>
                <PosterText variant="cardMeta" color={canvas.soft}>
                  {item.body}
                </PosterText>
              </View>
              {item.phase && (
                <PosterText variant="label" color={canvas.soft}>
                  {item.phase.toUpperCase()}
                </PosterText>
              )}
            </Pressable>
          );
        })}
    </View>
  );
}

/**
 * Which band the menu acts on, as Spotify's menu opens with the song's cover:
 * a small tile in the band's colour carrying its initial, and the name.
 */
function BandHeader({ name, accent }: { name: string; accent: { bg: string; fg: string } }) {
  const canvas = usePosterCanvas();
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={name}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md - 4,
        paddingHorizontal: spacing.xs,
        paddingBottom: spacing.sm + 2,
        marginBottom: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: canvas.rule,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          borderCurve: 'continuous',
          backgroundColor: accent.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PosterText variant="title" color={accent.fg}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </PosterText>
      </View>
      {/* No "BAND" over it: the sheet's own title already says Board. */}
      <PosterText variant="title" color={canvas.ink} numberOfLines={1} style={{ flex: 1 }}>
        {name}
      </PosterText>
    </View>
  );
}
