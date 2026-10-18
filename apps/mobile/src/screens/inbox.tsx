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
import { PosterText } from '@/components/poster-text';
import { useBoardScope } from '@/features/boards/use-board-scope';
import { PushPrompt } from '@/features/push/push-prompt';
import { shortAgo } from '@/features/board/format';
import {
  boardAccent,
  posterRadius,
  spacing,
  usePosterCanvas,
  useScheme,
  useThemeColors,
  type SlotHex,
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
 * Set like the calendar: the count as a poster headline over the list, and an
 * empty inbox said in the same huge type as an empty month.
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
              <Headline
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
            <View style={{ paddingTop: spacing.lg, gap: spacing.sm }}>
              <PosterText variant="display" color={colors.foreground}>
                Nothing for you.
              </PosterText>
              <PosterText variant="body" color={colors.mutedForeground}>
                {filteredTo === undefined
                  ? 'When someone @mentions you in a comment, it lands here.'
                  : `No one has mentioned you in ${filteredTo}.`}
              </PosterText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <MentionRow
            item={item}
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

/** "3 mentions", set as the calendar sets its month, with where in small caps. */
function Headline({ count, where }: { count: number; where: string | undefined }) {
  const canvas = usePosterCanvas();
  return (
    <View
      accessible
      accessibilityRole="header"
      style={{ paddingBottom: spacing.md }}
    >
      <PosterText variant="label" color={canvas.soft}>
        {where === undefined ? 'FOR YOU' : `FOR YOU · ${where.toUpperCase()}`}
      </PosterText>
      <PosterText
        variant="figure"
        color={canvas.ink}
        numberOfLines={1}
        // "12 mentions" at full size is wider than a small phone.
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {`${count} ${count === 1 ? 'mention' : 'mentions'}`}
      </PosterText>
    </View>
  );
}

/**
 * One mention: who, in which task, and what they said.
 *
 * The tile carries the person's initial in their band's colour, so under
 * "All" the band reads at a glance — and the band is also named in words, so
 * the colour never says it alone. The excerpt gets its own lines, set like
 * the comment it came from: it is usually the reason to open the task.
 */
function MentionRow({
  item,
  namesBoards,
  accent,
  onDismiss,
}: {
  item: MentionNotificationDto;
  namesBoards: boolean;
  accent: SlotHex | undefined;
  onDismiss: () => void;
}) {
  const colors = useThemeColors();

  const meta = [namesBoards ? item.boardName : null, shortAgo(item.createdAt)]
    .filter((part): part is string => part != null && part !== '')
    .join(' · ');
  // The sentence, not just the task: "Dana mentioned you in Mix notes" is
  // what the notification said, and the row should read the same way.
  const title = `${item.actorName} mentioned you in “${item.taskTitle}”`;
  const initial = item.actorName.trim().charAt(0).toUpperCase() || '@';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[title, item.excerpt, meta].filter(Boolean).join('. ')}
        // Opening leaves the row in place, matching web: it clears when the
        // person clears it, so a glance at the task does not lose the reminder.
        onPress={() => router.push(`/board/${item.boardId}/task/${item.taskId}`)}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: spacing.md - 4,
          paddingVertical: spacing.sm + 2,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            borderCurve: 'continuous',
            backgroundColor: accent?.bg ?? colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PosterText variant="title" color={accent?.fg ?? colors.foreground}>
            {initial}
          </PosterText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <PosterText variant="rowTitle" color={colors.foreground} numberOfLines={2}>
            {title}
          </PosterText>
          {item.excerpt !== '' && (
            <PosterText variant="paragraph" color={colors.mutedForeground} numberOfLines={2}>
              {item.excerpt}
            </PosterText>
          )}
          <PosterText variant="cardMeta" color={colors.mutedForeground} numberOfLines={1}>
            {meta}
          </PosterText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Dismiss mention from ${item.actorName}`}
        hitSlop={10}
        onPress={onDismiss}
        style={({ pressed }) => ({
          opacity: pressed ? 0.4 : 1,
          padding: spacing.xs,
          marginTop: spacing.sm + 2,
          borderRadius: posterRadius.chip,
        })}
      >
        <Icon name={{ sf: 'xmark', md: 'close' }} size={14} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}
