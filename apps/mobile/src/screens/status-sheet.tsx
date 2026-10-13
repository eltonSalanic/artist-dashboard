import { ActivityIndicator, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useBoard,
  useCanChangeStatus,
  useTask,
  useUpdateTask,
} from '@artist/api-client';
import { Icon } from '@/components/icon';
import { Dot } from '@/components/row';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, useThemeColors } from '@/theme';

/**
 * Pick a task's status. A sheet rather than a picker wheel or a menu: statuses
 * are the board's own (any number, any names, each with a colour), and a list
 * with the colour beside each name is the one control that shows all of that
 * on both platforms.
 *
 * The sheet closes once the change has been *refetched*, not merely sent, so
 * the screen underneath is already showing the new status when it reappears.
 */
export function StatusSheet({
  boardId,
  taskId,
}: {
  boardId: string;
  taskId: string;
}) {
  const colors = useThemeColors();
  const board = useBoard(boardId);
  const task = useTask(boardId, taskId);
  const update = useUpdateTask(boardId);
  const canChangeStatus = useCanChangeStatus();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const statuses = board.data?.statuses ?? [];
  const current = task.data?.statusId;
  const pendingId = update.isPending ? update.variables?.dto.statusId : null;
  // The row that opened this already checked; a stale link or a role change
  // since is why it is checked again rather than trusted.
  const allowed = task.data ? canChangeStatus(task.data.assignees) : false;

  const choose = (statusId: string) => {
    if (statusId === current) return router.back();
    update.mutate(
      { taskId, dto: { statusId } },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          router.back();
        },
      },
    );
  };

  return (
    // A plain View padded below the sheet's header, as in the band switcher: a
    // ScrollView is inset for the header natively, React Native's layout never
    // hears of it, and each row's press area sat a header's height off the row
    // (react-native#43546) — it lit up on touch and the release was dropped.
    <View
      style={{
        backgroundColor: colors.background,
        padding: spacing.md,
        paddingTop: headerHeight + spacing.sm,
        paddingBottom: spacing.md + insets.bottom,
        gap: spacing.xs,
      }}
    >
      {task.data && (
        <ThemedText
          variant="subhead"
          tone="muted"
          numberOfLines={2}
          style={{ marginBottom: spacing.xs }}
        >
          {task.data.title}
        </ThemedText>
      )}

      {board.isPending || task.isPending ? (
        [0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={48} />)
      ) : !allowed ? (
        <ThemedText variant="subhead" tone="muted">
          Only the people assigned to this task, or a band admin, can change its
          status.
        </ThemedText>
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
                disabled: update.isPending,
              }}
              disabled={update.isPending}
              onPress={() => choose(status.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 48,
                paddingHorizontal: spacing.md,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: selected || pressed ? colors.accent : colors.card,
              })}
            >
              <Dot color={status.color} size={12} />
              <ThemedText variant="body" style={{ flex: 1 }}>
                {status.name}
              </ThemedText>
              <View style={{ width: 22, alignItems: 'center' }}>
                {pendingId === status.id ? (
                  <ActivityIndicator size="small" />
                ) : selected ? (
                  <Icon
                    name={{ sf: 'checkmark', md: 'check' }}
                    size={17}
                    color={colors.primary}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
