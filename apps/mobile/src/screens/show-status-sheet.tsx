import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useBoard,
  useChangeShowStatus,
  useEvent,
  usePermissions,
} from '@artist/api-client';
import { cancelledShowMoneyNotice } from '@artist/shared';
import { Icon } from '@/components/icon';
import { PosterText } from '@/components/poster-text';
import { Dot } from '@/components/row';
import { Skeleton } from '@/components/skeleton';
import { face, posterRadius, spacing, usePosterCanvas } from '@/theme';

/**
 * Pick a show's status: the task status sheet's twin, over the board's show
 * statuses. Any member may use it ('show.changeStatus'); the rest of a show
 * stays with admins.
 *
 * Cancelling a show that still has a fee logged as expected says so before
 * closing, since the money is the part of a cancellation that is easy to miss.
 */
export function ShowStatusSheet({
  boardId,
  eventId,
}: {
  boardId: string;
  eventId: string;
}) {
  const canvas = usePosterCanvas();
  const board = useBoard(boardId);
  const event = useEvent(boardId, eventId);
  const change = useChangeShowStatus(boardId);
  const { can } = usePermissions();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const statuses = board.data?.showStatuses ?? [];
  const current = event.data?.showStatusId;
  const pendingId = change.isPending ? change.variables?.dto.showStatusId : null;
  const allowed = can('show.changeStatus') && !event.data?.archivedAt;

  const choose = (showStatusId: string) => {
    if (showStatusId === current) return router.back();
    change.mutate(
      { eventId, dto: { showStatusId } },
      {
        onSuccess: ({ expectedIncomeCents }) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (expectedIncomeCents > 0) {
            Alert.alert(
              'Money still expected',
              cancelledShowMoneyNotice(expectedIncomeCents, board.data?.currency),
              [{ text: 'OK', onPress: () => router.back() }],
            );
            return;
          }
          router.back();
        },
      },
    );
  };

  return (
    // A plain View, not a ScrollView: see StatusSheet for why.
    <View
      style={{
        backgroundColor: canvas.background,
        padding: spacing.md,
        paddingTop: headerHeight + spacing.sm,
        paddingBottom: spacing.md + insets.bottom,
        gap: spacing.xs,
      }}
    >
      {event.data && (
        <View
          style={{
            paddingHorizontal: spacing.xs,
            paddingBottom: spacing.sm + 2,
            marginBottom: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: canvas.rule,
          }}
        >
          <PosterText variant="title" color={canvas.ink} numberOfLines={2}>
            {event.data.title}
          </PosterText>
        </View>
      )}

      {board.isPending || event.isPending ? (
        [0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={48} />)
      ) : !allowed ? (
        <PosterText variant="paragraph" color={canvas.soft} style={{ paddingHorizontal: spacing.xs }}>
          {"An archived show's status can't be changed."}
        </PosterText>
      ) : (
        statuses.map((status) => {
          const selected = status.id === current;
          return (
            <Pressable
              key={status.id}
              accessibilityRole="radio"
              accessibilityState={{
                selected,
                busy: pendingId === status.id,
                disabled: change.isPending,
              }}
              disabled={change.isPending}
              onPress={() => choose(status.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 52,
                paddingHorizontal: spacing.sm + 4,
                borderRadius: posterRadius.block,
                borderCurve: 'continuous',
                backgroundColor: selected || pressed ? canvas.faint : 'transparent',
              })}
            >
              <Dot color={status.color} size={14} />
              <PosterText
                variant="rowTitle"
                color={canvas.ink}
                style={[{ flex: 1 }, selected && { fontFamily: face.heavy }]}
              >
                {status.name}
              </PosterText>
              <View style={{ width: 22, alignItems: 'center' }}>
                {pendingId === status.id ? (
                  <ActivityIndicator size="small" color={canvas.ink} />
                ) : selected ? (
                  <Icon name={{ sf: 'checkmark', md: 'check' }} size={17} color={canvas.ink} />
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
