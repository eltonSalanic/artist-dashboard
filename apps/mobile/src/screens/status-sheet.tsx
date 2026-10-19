import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
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
import { PosterText } from '@/components/poster-text';
import { Dot } from '@/components/row';
import { Skeleton } from '@/components/skeleton';
import { face, posterRadius, spacing, usePosterCanvas } from '@/theme';

/**
 * Pick a task's status. A sheet rather than a picker wheel or a menu: statuses
 * are the board's own (any number, any names, each with a colour), and a list
 * with the colour beside each name is the one control that shows all of that
 * on both platforms.
 *
 * The sheet closes once the change has been *refetched*, not merely sent, so
 * the screen underneath is already showing the new status when it reappears.
 *
 * Moving a task into a done status finishes its open subtasks on the server,
 * with no "this task only" — a task is not done while its subtasks are not —
 * so with any open it asks first and says how many, as completing a goal does.
 *
 * Set like the board menu: the task it acts on first, set as the detail screen
 * sets it, then bare rows. The current status is a filled row with a tick, so
 * a band whose statuses share a colour still shows which one the task is in.
 */
export function StatusSheet({
  boardId,
  taskId,
}: {
  boardId: string;
  taskId: string;
}) {
  const canvas = usePosterCanvas();
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
    const open = task.data?.openSubtaskCount ?? 0;
    const finishing =
      statuses.find((s) => s.id === statusId)?.isDone === true &&
      task.data?.status.isDone === false;
    if (finishing && open > 0) {
      const noun = open === 1 ? 'subtask' : 'subtasks';
      Alert.alert(
        'Complete this task?',
        `"${task.data?.title}" still has ${open} open ${noun}. Completing it marks ${open === 1 ? 'it' : 'them'} done too.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Complete task and ${open} ${noun}`,
            onPress: () => save(statusId),
          },
        ],
      );
      return;
    }
    save(statusId);
  };

  const save = (statusId: string) =>
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

  return (
    // A plain View padded below the sheet's header, as in the band switcher: a
    // ScrollView is inset for the header natively, React Native's layout never
    // hears of it, and each row's press area sat a header's height off the row
    // (react-native#43546) — it lit up on touch and the release was dropped.
    <View
      style={{
        backgroundColor: canvas.background,
        padding: spacing.md,
        paddingTop: headerHeight + spacing.sm,
        paddingBottom: spacing.md + insets.bottom,
        gap: spacing.xs,
      }}
    >
      {task.data && (
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
            {task.data.title}
          </PosterText>
        </View>
      )}

      {board.isPending || task.isPending ? (
        [0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={48} />)
      ) : !allowed ? (
        <PosterText variant="paragraph" color={canvas.soft} style={{ paddingHorizontal: spacing.xs }}>
          Only the people assigned to this task, or a band admin, can change its status.
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
                disabled: update.isPending,
              }}
              disabled={update.isPending}
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
                  <Icon
                    name={{ sf: 'checkmark', md: 'check' }}
                    size={17}
                    color={canvas.ink}
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
