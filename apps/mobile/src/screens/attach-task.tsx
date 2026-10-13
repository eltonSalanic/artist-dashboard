import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTasks, useUpdateTask, type TaskDto } from '@artist/api-client';
import { Dot, Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import type { TaskLink } from '@/features/links/linked-tasks';

/**
 * Pick a task to attach to a goal or event. Root tasks only, like web: a
 * subtask goes where its parent goes.
 *
 * A pushed screen, not a sheet — the list can be long, and a scrolling sheet
 * is where press areas drift off their rows (react-native#43546). It goes back
 * once the link has been refetched, so the list underneath already shows it.
 *
 * A task linked elsewhere says so: a task has one goal and one event, so
 * attaching it here moves it.
 */
export function AttachTaskScreen({
  boardId,
  link,
}: {
  boardId: string;
  link: TaskLink;
}) {
  const tasks = useTasks(boardId, { sort: 'order' });
  const update = useUpdateTask(boardId);
  const attaching = update.isPending ? update.variables?.taskId : null;

  const linkedHere = (task: TaskDto) =>
    'goalId' in link ? task.goal?.id === link.goalId : task.event?.id === link.eventId;
  const elsewhere = (task: TaskDto) => {
    const other = 'goalId' in link ? task.goal?.title : task.event?.title;
    return other ? `moves from ${other}` : null;
  };

  const candidates = (tasks.data ?? []).filter(
    (task) => task.parentTaskId === null && !linkedHere(task),
  );

  const attach = (task: TaskDto) =>
    update.mutate(
      { taskId: task.id, dto: link },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    );

  return (
    <SpokeList
      pending={tasks.isPending}
      error={tasks.error}
      onRetry={() => void tasks.refetch()}
      empty={candidates.length === 0}
      emptyIcon={{ sf: 'checklist', md: 'checklist' }}
      emptyTitle="Nothing to attach"
      emptyBody="Every task on the board is already linked here."
    >
      {candidates.map((task, index) => (
        <Row
          key={task.id}
          first={index === 0}
          title={task.title}
          meta={[task.status.name, elsewhere(task)].filter(Boolean).join(' · ')}
          dim={task.status.isDone}
          lead={<Dot color={task.status.color} />}
          trailing={attaching === task.id ? <ActivityIndicator size="small" /> : undefined}
          onPress={update.isPending ? undefined : () => attach(task)}
        />
      ))}
    </SpokeList>
  );
}
