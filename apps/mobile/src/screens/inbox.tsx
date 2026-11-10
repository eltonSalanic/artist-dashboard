import { useMemo } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Stack } from 'expo-router';
import {
  useClearInbox,
  useDismissInboxItem,
  useInbox,
  useMe,
} from '@artist/api-client';
import type { BoardSummaryDto } from '@artist/shared';
import { BoardFilter } from '@/components/board-filter';
import { ListState } from '@/components/list-state';
import { MyMascot, PhraseLettering } from '@/components/mascot';
import { PosterText } from '@/components/poster-text';
import { useBoardScope } from '@/features/boards/use-board-scope';
import { PushPrompt } from '@/features/push/push-prompt';
import { NotificationCard } from '@/features/inbox/notification-card';
import {
  boardAccent,
  spacing,
  usePosterCanvas,
  useScheme,
  useThemeColors,
} from '@/theme';
import { useRefetchOnFocus } from '@/lib/refetch-on-focus';

/**
 * Every comment that mentions you, across every band, newest first.
 *
 * This is the one screen in the app where "unread" has a real definition: a
 * `MentionNotification` row exists until it is dismissed. Nothing has to track
 * what the person has looked at, which is why the Inbox gets a tab badge and the
 * activity feed does not — a feed is a log of what happened, and "N new since
 * your last visit" would need a per-device marker to mean anything.
 *
 * One card per notification (`NotificationCard`) under a one-line count, and
 * an empty inbox said in the same huge type as an empty month.
 */
export function InboxScreen() {
  const colors = useThemeColors();
  const scope = useBoardScope('inbox');
  useRefetchOnFocus();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BoardFilter
        boards={scope.boards}
        boardId={scope.boardId}
        onSelect={scope.select}
      />
      {/* Mounted once the stored filter is known, so the first request is the
          one the person asked for. */}
      {scope.ready && <Mentions boardId={scope.boardId} boards={scope.boards} />}
    </View>
  );
}

function Mentions({
  boardId,
  boards,
}: {
  boardId: string | undefined;
  boards: BoardSummaryDto[];
}) {
  const colors = useThemeColors();
  const scheme = useScheme();
  const inbox = useInbox(boardId);
  // Only to find the reader's own @handle in a comment, which is set bold.
  const myName = useMe(true).data?.user.displayName;
  const dismiss = useDismissInboxItem();
  const clear = useClearInbox(boardId);

  const items = inbox.data ?? [];
  const namesBoards = boards.length > 1;
  const accents = useMemo(
    () =>
      new Map(boards.map((board) => [board.id, boardAccent(board.palette, scheme)])),
    [boards, scheme],
  );

  const filteredTo = boards.find((board) => board.id === boardId)?.name;

  /**
   * Clearing is confirmed because of its blast radius, and the prompt names
   * what it will take.
   *
   * Unfiltered, one tap empties several bands' worth of mentions at once; the
   * server takes the same filter the list is showing, so "Clear all" while
   * filtered means *this* band. Saying which in the prompt is the difference
   * between a confirmation and a formality.
   */
  const confirmClear = () =>
    Alert.alert(
      filteredTo === undefined ? 'Clear every mention?' : `Clear ${filteredTo}?`,
      filteredTo === undefined
        ? `This removes all ${items.length} mentions, across every band. The comments themselves stay.`
        : `This removes ${items.length} mentions from ${filteredTo}. The comments themselves stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => clear.mutate(),
        },
      ],
    );

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl, flexGrow: 1 }}
        ListHeaderComponent={
          <>
            <PushPrompt />
            {items.length > 0 && (
              <Summary
                count={items.length}
                where={filteredTo ?? (namesBoards ? 'Every band' : undefined)}
              />
            )}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void inbox.refetch()}
            tintColor={colors.mutedForeground}
          />
        }
        ListEmptyComponent={
          inbox.isPending || inbox.error ? (
            <ListState
              pending={inbox.isPending}
              error={inbox.error}
              onRetry={() => void inbox.refetch()}
              icon={{ sf: 'tray', md: 'inbox' }}
              title=""
            />
          ) : (
            // Fills the room under the header, like the calendar's empty month.
            <View style={{ flex: 1, justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.xl }}>
              <View style={{ alignSelf: 'center', alignItems: 'center', gap: spacing.md }}>
                <PhraseLettering phrase="nothingForYou" label="Nothing for you." />
                <MyMascot pose="emptyBare" width={180} />
              </View>
              <PosterText
                variant="body"
                color={colors.mutedForeground}
                style={{ textAlign: 'center' }}
              >
                {filteredTo === undefined
                  ? 'When someone @mentions you in a comment, it lands here.'
                  : `No one has mentioned you in ${filteredTo}.`}
              </PosterText>
            </View>
          )
        }
        ItemSeparatorComponent={CardGap}
        renderItem={({ item }) => (
          <NotificationCard
            item={item}
            namesBoards={namesBoards}
            accent={accents.get(item.boardId)}
            myName={myName}
            onDismiss={() => dismiss.mutate(item.id)}
          />
        )}
      />

      <Stack.Screen
        options={{
          title: 'Inbox',
          // Only once there is something to clear. A permanently visible
          // destructive action on an empty screen is a trap with nothing behind
          // it. `headerRight` rather than `Stack.Toolbar`, which is iOS-only.
          headerRight: () =>
            items.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear mentions"
                hitSlop={8}
                onPress={confirmClear}
                disabled={clear.isPending}
                style={({ pressed }) => ({
                  opacity: pressed || clear.isPending ? 0.5 : 1,
                })}
              >
                <PosterText variant="rowTitle" color={colors.primary}>
                  Clear all
                </PosterText>
              </Pressable>
            ) : null,
        }}
      />
    </>
  );
}

/**
 * "9 FOR YOU · EVERY BAND": the count and the scope in one small caps line.
 * The cards are the screen now, so the count is a caption over them rather
 * than a headline taller than a card.
 */
function Summary({ count, where }: { count: number; where: string | undefined }) {
  const canvas = usePosterCanvas();
  return (
    <PosterText
      variant="label"
      color={canvas.soft}
      accessibilityRole="header"
      numberOfLines={1}
      style={{ paddingBottom: CARD_GAP }}
    >
      {where === undefined ? `${count} FOR YOU` : `${count} FOR YOU · ${where.toUpperCase()}`}
    </PosterText>
  );
}

function CardGap() {
  return <View style={{ height: CARD_GAP }} />;
}

/** Between two cards: enough page to see each as its own thing. */
const CARD_GAP = spacing.sm + spacing.xs;
