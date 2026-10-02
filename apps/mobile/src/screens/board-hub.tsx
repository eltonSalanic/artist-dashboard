import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useSelectedBoard } from '@/features/board/selected-board';
import { spacing, useThemeColors } from '@/theme';

/**
 * The board hub. One board's widgets as summaries; tapping one opens its spoke
 * (P8). There is no tab strip here on purpose — a ten-item horizontal scroller
 * is a poor index, because you cannot see what is available, you discover it by
 * scrolling blind. The card grid shows every widget with its numbers, which is
 * a better index than tabs could be.
 */
export function BoardHubScreen() {
  const colors = useThemeColors();
  const { board, boards, loading } = useSelectedBoard();

  if (!loading && boards.length === 0) {
    return (
      <View style={styles.centered(colors.background)}>
        <Icon
          name={{ sf: 'music.note.house', md: 'home-work' }}
          size={36}
          color={colors.mutedForeground}
        />
        <ThemedText variant="title">No band yet</ThemedText>
        <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
          Signing in normally creates your first board. Ask an admin to invite
          you, or start one on the web.
        </ThemedText>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
      >
        <View style={styles.centered(colors.background)}>
          <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
            The widget cards land here next.
          </ThemedText>
        </View>
      </ScrollView>

      {/* The board name *is* the switcher. Tapping a title to change context is
          the Slack/Notion/Linear convention and needs no teaching. */}
      <Stack.Screen
        options={{
          headerTitle: () => <BoardTitle name={board?.name ?? 'Board'} />,
          headerRight: () => <BoardMenuButton />,
        }}
      />
    </>
  );
}

function BoardTitle({ name }: { name: string }) {
  const colors = useThemeColors();
  return (
    <Link href="/boards" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name}. Change band`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ThemedText variant="headline" numberOfLines={1}>
          {name}
        </ThemedText>
        <Icon
          name={{ sf: 'chevron.down', md: 'expand-more' }}
          size={14}
          color={colors.mutedForeground}
        />
      </Pressable>
    </Link>
  );
}

function BoardMenuButton() {
  const colors = useThemeColors();
  return (
    <Link href="/board-menu" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Board options"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Icon
          name={{ sf: 'ellipsis', md: 'more-horiz' }}
          size={20}
          color={colors.primary}
        />
      </Pressable>
    </Link>
  );
}

const styles = {
  centered: (background: string) => ({
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: background,
  }),
};
