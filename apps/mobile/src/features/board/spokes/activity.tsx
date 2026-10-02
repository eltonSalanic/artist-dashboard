import { FlatList, View } from 'react-native';
import { useActivityFeed } from '@artist/api-client';
import { activityText } from '@artist/shared';
import type { ActivityType } from '@artist/shared';
import { Icon, type IconName } from '@/components/icon';
import { Row } from '@/components/row';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { shortAgo } from '../format';
import { spacing, useTokens } from '@/theme';

/** The icon per event type — the sentence itself is shared with web. */
const icons: Record<ActivityType, IconName> = {
  TASK_CREATED: { sf: 'plus', md: 'add' },
  TASK_COMPLETED: { sf: 'checkmark.circle.fill', md: 'check-circle' },
  STATUS_CHANGED: { sf: 'arrow.triangle.2.circlepath', md: 'sync' },
  MEMBER_ASSIGNED: { sf: 'person.badge.plus', md: 'person-add' },
  MEMBER_REMOVED: { sf: 'person.badge.minus', md: 'person-remove' },
  GOAL_COMPLETED: { sf: 'target', md: 'track-changes' },
  FILE_UPLOADED: { sf: 'paperclip', md: 'attach-file' },
  COMMENT_ADDED: { sf: 'bubble.left', md: 'chat-bubble-outline' },
};

/**
 * The feed, paginated. Its own `FlatList` rather than the shared `SpokeList`:
 * this is the one spoke that can run to hundreds of rows, so it needs
 * virtualisation and an `onEndReached`, and a list inside a scroll view is
 * exactly what breaks both.
 */
export function ActivitySpoke({ boardId }: { boardId: string }) {
  const tokens = useTokens();
  const feed = useActivityFeed(boardId);
  const items = feed.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) {
          void feed.fetchNextPage();
        }
      }}
      ListEmptyComponent={
        feed.isPending ? (
          <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ gap: spacing.xs }}>
                <Skeleton width="80%" height={16} />
                <Skeleton width="30%" height={11} />
              </View>
            ))}
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            <Icon
              name={{ sf: 'waveform.path.ecg', md: 'timeline' }}
              size={28}
              color={tokens.mutedForeground}
            />
            <ThemedText variant="headline">Nothing has happened yet</ThemedText>
            <ThemedText variant="subhead" tone="muted" style={{ textAlign: 'center' }}>
              Tasks, goals and comments show up here as the band works.
            </ThemedText>
          </View>
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <View style={{ paddingVertical: spacing.md }}>
            <Skeleton width="70%" height={16} />
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <Row
          first={index === 0}
          // The feed never joins back to live records, so the actor's name is
          // whatever was true when it happened — and null once they are gone.
          title={`${item.actor?.displayName ?? 'Someone'} ${activityText(item)}`}
          trailing={shortAgo(item.createdAt)}
          lead={<Icon name={icons[item.type] ?? icons.STATUS_CHANGED} size={15} />}
        />
      )}
    />
  );
}
