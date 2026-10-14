import { useMemo } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Stack, router } from 'expo-router';
import {
  useClearInbox,
  useDismissInboxItem,
  useInbox,
  type MentionNotificationDto,
} from '@artist/api-client';
import type { BoardSummaryDto } from '@artist/shared';
import { BoardFilter } from '@/components/board-filter';
import { Icon } from '@/components/icon';
import { ListState } from '@/components/list-state';
import { Dot, Row } from '@/components/row';
import { ThemedText } from '@/components/themed-text';
import { useBoardScope } from '@/features/boards/use-board-scope';
import { PushPrompt } from '@/features/push/push-prompt';
import { shortAgo } from '@/features/board/format';
import { boardAccent, spacing, useScheme, useThemeColors } from '@/theme';
import { useRefetchOnFocus } from '@/lib/refetch-on-focus';

/**
 * Every comment that mentions you, across every band, newest first.
 *
 * This is the one screen in the app where "unread" has a real definition: a
 * `MentionNotification` row exists until it is dismissed. Nothing has to track
 * what the person has looked at, which is why the Inbox gets a tab badge and the
 * activity feed does not — a feed is a log of what happened, and "N new since
 * your last visit" would need a per-device marker to mean anything.
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
  const dismiss = useDismissInboxItem();
  const clear = useClearInbox(boardId);

  const items = inbox.data ?? [];
  const namesBoards = boards.length > 1;
  const accents = useMemo(
    () =>
      new Map(
        boards.map((board) => [board.id, boardAccent(board.palette, scheme).bg]),
      ),
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
        contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
        ListHeaderComponent={<PushPrompt />}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => void inbox.refetch()}
            tintColor={colors.mutedForeground}
          />
        }
        ListEmptyComponent={
          <ListState
            pending={inbox.isPending}
            error={inbox.error}
            onRetry={() => void inbox.refetch()}
            icon={{ sf: 'tray', md: 'inbox' }}
            title="Nothing for you"
            body={
              filteredTo === undefined
                ? 'When someone @mentions you in a comment, it lands here.'
                : `No one has mentioned you in ${filteredTo}.`
            }
          />
        }
        renderItem={({ item, index }) => (
          <MentionRow
            item={item}
            first={index === 0}
            namesBoards={namesBoards}
            accent={accents.get(item.boardId)}
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
                <ThemedText variant="subhead" style={{ color: colors.primary }}>
                  Clear all
                </ThemedText>
              </Pressable>
            ) : null,
        }}
      />
    </>
  );
}

function MentionRow({
  item,
  first,
  namesBoards,
  accent,
  onDismiss,
}: {
  item: MentionNotificationDto;
  first: boolean;
  namesBoards: boolean;
  accent: string | undefined;
  onDismiss: () => void;
}) {
  const colors = useThemeColors();

  // The band, then when — the excerpt is the title's second line, so the meta
  // stays short enough to read in one pass.
  const meta = [namesBoards ? item.boardName : null, shortAgo(item.createdAt)]
    .filter((part): part is string => part != null && part !== '')
    .join(' · ');

  return (
    <Row
      first={first}
      // The sentence, not just the task: "Dana mentioned you in Mix notes" is
      // what the notification said, and the row should read the same way.
      title={`${item.actorName} mentioned you in “${item.taskTitle}”`}
      meta={`${meta}${item.excerpt === '' ? '' : ` · ${item.excerpt}`}`}
      lead={
        namesBoards && accent !== undefined ? (
          <Dot color={accent} />
        ) : (
          <Icon name={{ sf: 'at', md: 'alternate-email' }} size={15} />
        )
      }
      // Opening leaves the row in place, matching web: it clears when the person
      // clears it, so a glance at the task does not lose the reminder.
      onPress={() => router.push(`/board/${item.boardId}/task/${item.taskId}`)}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dismiss mention from ${item.actorName}`}
          hitSlop={10}
          onPress={onDismiss}
          style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 2 })}
        >
          <Icon
            name={{ sf: 'xmark', md: 'close' }}
            size={14}
            color={colors.mutedForeground}
          />
        </Pressable>
      }
    />
  );
}
