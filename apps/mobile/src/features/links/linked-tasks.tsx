import { ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import {
  usePermissions,
  useTasks,
  useUpdateTask,
} from '@artist/api-client';
import { Dot, Row } from '@/components/row';
import { Icon } from '@/components/icon';
import { Section } from '@/components/section';
import { Skeleton } from '@/components/skeleton';
import { PosterText } from '@/components/poster-text';
import { dueDay, shortDate } from '@/features/board/format';
import { useThemeColors } from '@/theme';

/** Which side of the link this list belongs to — exactly one is set. */
export type TaskLink = { goalId: string } | { eventId: string };

/** The query string a route takes for a link: `goalId=…` or `eventId=…`. */
export function linkQuery(link: TaskLink): string {
  return 'goalId' in link ? `goalId=${link.goalId}` : `eventId=${link.eventId}`;
}

/**
 * The tasks attached to a goal or an event — web's `LinkedTasks`, on the
 * phone. Everyone sees the list and can open a task; an admin can also add a
 * new linked task, attach an existing one, or unlink one, since linking is
 * editing a task's fields (`task.editFields`).
 *
 * An archived goal or event lists its archived tasks too (they went down with
 * it), and takes no new links: it is off the dashboard.
 */
export function LinkedTasks({
  boardId,
  link,
  archived,
}: {
  boardId: string;
  link: TaskLink;
  archived: boolean;
}) {
  const colors = useThemeColors();
  const { can } = usePermissions();
  const tasks = useTasks(boardId, { ...link, includeArchived: archived });
  const update = useUpdateTask(boardId);
  const canEdit = can('task.editFields') && !archived;
  const unlinkDto = 'goalId' in link ? { goalId: null } : { eventId: null };
  const unlinking = update.isPending ? update.variables?.taskId : null;

  // Subtasks are reached through their parent, as everywhere else on the phone.
  const roots = (tasks.data ?? []).filter((t) => t.parentTaskId === null);

  return (
    <Section
      title={roots.length > 0 ? `TASKS · ${roots.length}` : 'TASKS'}
      action={
        canEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a linked task"
            hitSlop={10}
            onPress={() => router.push(`/board/${boardId}/form/task?${linkQuery(link)}`)}
          >
            <PosterText variant="chip" color={colors.primary}>
              Add
            </PosterText>
          </Pressable>
        ) : undefined
      }
    >
      {tasks.isPending ? (
        <Skeleton width="100%" height={48} />
      ) : roots.length === 0 ? (
        <PosterText variant="cardMeta" color={colors.mutedForeground}>
          No tasks linked yet.
        </PosterText>
      ) : (
        roots.map((task, index) => (
          <Row
            key={task.id}
            first={index === 0}
            title={task.title}
            meta={[
              task.status.name,
              task.subtaskCount > 0 ? `${task.subtaskCount} subtasks` : null,
              task.dueDate ? shortDate(dueDay(task.dueDate)) : null,
              task.archivedAt ? 'archived' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            dim={task.status.isDone}
            lead={<Dot color={task.status.color} />}
            onPress={() => router.push(`/board/${boardId}/task/${task.id}`)}
            trailing={
              canEdit ? (
                unlinking === task.id ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Unlink ${task.title}`}
                    hitSlop={12}
                    disabled={update.isPending}
                    onPress={() => update.mutate({ taskId: task.id, dto: unlinkDto })}
                  >
                    <Icon
                      name={{ sf: 'minus.circle', md: 'link-off' }}
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                )
              ) : undefined
            }
          />
        ))
      )}

      {canEdit && (
        <Row
          first={roots.length === 0 && !tasks.isPending}
          title="Attach an existing task"
          lead={
            <Icon name={{ sf: 'link', md: 'link' }} size={16} color={colors.primary} />
          }
          onPress={() => router.push(`/board/${boardId}/attach?${linkQuery(link)}`)}
        />
      )}
    </Section>
  );
}
