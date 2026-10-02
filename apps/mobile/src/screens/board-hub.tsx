import { Link, Stack, router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useBoard } from '@artist/api-client';
import { resolveBoardTheme } from '@artist/shared';
import { Icon } from '@/components/icon';
import { HubCardSkeleton, HubStatCard } from '@/components/stat-card';
import { ThemedText } from '@/components/themed-text';
import { useSelectedBoard } from '@/features/board/selected-board';
import { useHubCards } from '@/features/board/use-hub-cards';
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
      {board !== null && <HubGrid boardId={board.id} />}

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

/**
 * Mounted only once a board exists, so none of the nine widget queries fire
 * against a `/boards//...` URL while the selection is still resolving.
 */
function HubGrid({ boardId }: { boardId: string }) {
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const detail = useBoard(boardId);
  const { cards, loading, error } = useHubCards(
    boardId,
    resolveBoardTheme(detail.data?.theme),
  );

  if (error) {
    return (
      <View style={styles.centered(colors.background)}>
        <ThemedText variant="headline" tone="destructive">
          Could not load this board
        </ThemedText>
        <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
          {error.message}
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            // Pull-to-refresh is the gesture people already try on a phone;
            // invalidating the board's whole subtree is cheaper to reason about
            // than listing nine keys that must stay in sync with the hook.
            void queryClient.invalidateQueries();
          }}
          tintColor={colors.mutedForeground}
        />
      }
    >
      <View style={styles.grid}>
        {loading
          ? // The layout decides how many cards there are, so until it lands
            // the count is a guess. Six keeps the screen from jumping much.
            Array.from({ length: 6 }, (_, index) => (
              <View key={index} style={styles.stat}>
                <HubCardSkeleton />
              </View>
            ))
          : cards.map((card) => (
              <View
                key={card.widgetType}
                style={card.kind === 'hero' ? styles.hero : styles.stat}
              >
                <HubStatCard
                  card={card}
                  onPress={() =>
                    router.push(`/board/${boardId}/w/${card.widgetType}`)
                  }
                />
              </View>
            ))}
      </View>
    </ScrollView>
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
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    rowGap: spacing.sm,
  },
  /** Prose: the full width. */
  hero: { width: '100%' as const },
  /** Countable: two up, and a lone trailing card stays half-width. */
  stat: { width: '48.5%' as const },
  centered: (background: string) => ({
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: background,
  }),
};
