import { router } from 'expo-router';
import { useMe, useTasks } from '@artist/api-client';
import type { TaskDto } from '@artist/api-client';
import { Dot, Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { shortDate } from '../format';

/** Priority is only worth saying when it is not the middle. */
function meta(task: TaskDto): string {
  const parts = [task.status.name];
  if (task.priority !== 'MEDIUM') parts.push(task.priority.toLowerCase());
  if (task.assignees.length > 0) {
    parts.push(task.assignees.map((a) => a.displayName).join(', '));
  }
  if (task.subtaskCount > 0) parts.push(`${task.subtaskCount} subtasks`);
  return parts.join(' · ');
}

function TaskRows({
  tasks,
  boardId,
}: {
  tasks: TaskDto[];
  boardId: string;
}) {
  return tasks.map((task, index) => (
    <Row
      key={task.id}
      first={index === 0}
      title={task.title}
      meta={meta(task)}
      dim={task.status.isDone}
      // Colour never carries alone: the status name is in the meta line too.
      lead={<Dot color={task.status.color} />}
      trailing={task.dueDate ? shortDate(task.dueDate) : undefined}
      onPress={() => router.push(`/board/${boardId}/task/${task.id}`)}
    />
  ));
}

/** Everything on the board. Subtasks are reached through their parent. */
export function TodosSpoke({ boardId }: { boardId: string }) {
  const tasks = useTasks(boardId);
  const roots = (tasks.data ?? []).filter((t) => t.parentTaskId === null);

  return (
    <SpokeList
      pending={tasks.isPending}
      error={tasks.error}
      onRetry={() => void tasks.refetch()}
      empty={roots.length === 0}
      emptyIcon={{ sf: 'checklist', md: 'checklist' }}
      emptyTitle="Nothing to do"
      emptyBody="Tasks added on the web dashboard show up here."
    >
      <TaskRows tasks={roots} boardId={boardId} />
    </SpokeList>
  );
}

/** The caller's own tasks, soonest due first. */
export function MyTasksSpoke({ boardId }: { boardId: string }) {
  const me = useMe(true);
  const tasks = useTasks(
    boardId,
    me.data ? { assigneeId: me.data.user.id, sort: 'dueDate' } : {},
  );
  const roots = (tasks.data ?? []).filter((t) => t.parentTaskId === null);

  return (
    <SpokeList
      pending={tasks.isPending || me.isPending}
      error={tasks.error}
      onRetry={() => void tasks.refetch()}
      empty={roots.length === 0}
      emptyIcon={{ sf: 'person.crop.circle.badge.checkmark', md: 'assignment-ind' }}
      emptyTitle="Nothing assigned to you"
      emptyBody="Tasks someone assigns you will appear here."
    >
      <TaskRows tasks={roots} boardId={boardId} />
    </SpokeList>
  );
}
