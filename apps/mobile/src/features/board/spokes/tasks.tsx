import { useCallback, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Gesture } from 'react-native-gesture-handler';
import ReorderableList, { useReorderableDrag } from 'react-native-reorderable-list';
import { scheduleOnRN } from 'react-native-worklets';
import {
  useCanChangeStatus,
  useMe,
  usePermissions,
  useReorderTask,
  useTasks,
} from '@artist/api-client';
import type { TaskDto } from '@artist/api-client';
import { Dot, Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { PosterText } from '@/components/poster-text';
import { spacing, usePosterCanvas } from '@/theme';
import { dueDay, isThisWeek, isToday, shortDate } from '../format';
import { planMove } from '../reorder';
import { SpokeHeader } from '../spoke-header';
import { activeFilters, canDragInView, keepTask, taskQuery } from '../task-view';
import { TaskViewControls, useTaskView, type TaskViewState } from './task-view-controls';

/** "6 open · 2 due today", or null when there is nothing to count. */
function openSummary(tasks: TaskDto[], soon: 'today' | 'week'): string | null {
  const open = tasks.filter((task) => !task.status.isDone);
  if (tasks.length === 0) return null;
  const due = open.filter(
    (task) =>
      task.dueDate !== null &&
      (soon === 'today' ? isToday(dueDay(task.dueDate)) : isThisWeek(dueDay(task.dueDate))),
  ).length;
  return `${open.length} open${due > 0 ? ` · ${due} due ${soon === 'today' ? 'today' : 'this week'}` : ''}`;
}

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

function TaskRow({
  task,
  boardId,
  first,
  onLongPress,
  accessibilityActions,
  onAccessibilityAction,
}: {
  task: TaskDto;
  boardId: string;
  first: boolean;
} & Pick<
  React.ComponentProps<typeof Row>,
  'onLongPress' | 'accessibilityActions' | 'onAccessibilityAction'
>) {
  const canChangeStatus = useCanChangeStatus();
  return (
    <Row
      first={first}
      title={task.title}
      meta={meta(task)}
      dim={task.status.isDone}
      // Colour never carries alone: the status name is in the meta line too.
      lead={
        canChangeStatus(task.assignees) ? (
          <StatusDot task={task} boardId={boardId} />
        ) : (
          <Dot color={task.status.color} />
        )
      }
      trailing={task.dueDate ? shortDate(dueDay(task.dueDate)) : undefined}
      onPress={() => router.push(`/board/${boardId}/task/${task.id}`)}
      onLongPress={onLongPress}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    />
  );
}

function TaskRows({ tasks, boardId }: { tasks: TaskDto[]; boardId: string }) {
  return tasks.map((task, index) => (
    <TaskRow key={task.id} task={task} boardId={boardId} first={index === 0} />
  ));
}

/**
 * The row's status dot, as a shortcut to the status sheet — the same sheet
 * task detail opens, so a status changes one way everywhere. The dot is small;
 * the slop makes the target the size of a thumb without moving the layout.
 */
function StatusDot({ task, boardId }: { task: TaskDto; boardId: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Status: ${task.status.name}`}
      accessibilityHint="Changes the status"
      hitSlop={14}
      onPress={() => router.push(`/board/${boardId}/status/${task.id}`)}
    >
      <Dot color={task.status.color} size={12} />
    </Pressable>
  );
}

/** What an empty list says: nothing at all, or nothing this filter lets through. */
function emptyCopy(state: TaskViewState, title: string, body: string) {
  if (state.view.search !== '') {
    return { emptyTitle: 'No tasks match', emptyBody: 'No task title has those words.' };
  }
  return activeFilters(state.view) > 0
    ? { emptyTitle: 'No tasks match', emptyBody: 'Try another filter, or clear them.' }
    : { emptyTitle: title, emptyBody: body };
}

/**
 * Everything on the board, in the board's own order — the order web's To-Do
 * widget shows and an admin can drag — unless sorted or filtered otherwise.
 * Subtasks are reached through their parent.
 */
export function TodosSpoke({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const state = useTaskView('order');
  const tasks = useTasks(boardId, taskQuery(state.view));
  const roots = (tasks.data ?? []).filter(
    (t) => t.parentTaskId === null && keepTask(state.view, t),
  );
  const header = (
    <>
      <SpokeHeader boardId={boardId} widgetType="TODOS" summary={openSummary(roots, 'today')} />
      <TaskViewControls boardId={boardId} state={state} byAssignee />
    </>
  );

  // Reorder is ADMIN-only at the endpoint (`@BoardRoles('ADMIN')`), and
  // `task.editFields` is the shared map's name for exactly that. Only in the
  // board's own order, unfiltered, which is the order a drag changes.
  if (
    can('task.editFields') &&
    canDragInView(state.view) &&
    // Swapping lists remounts the header, so the search field would lose the
    // keyboard on its first keystroke; while it is open, the plain list stays.
    state.panel !== 'search' &&
    !tasks.isPending &&
    !tasks.error &&
    roots.length > 0
  ) {
    return (
      <ReorderableTodos
        tasks={roots}
        boardId={boardId}
        basis={tasks.dataUpdatedAt}
        header={header}
      />
    );
  }

  return (
    <SpokeList
      pending={tasks.isPending}
      error={tasks.error}
      onRetry={() => void tasks.refetch()}
      empty={roots.length === 0}
      emptyIcon={{ sf: 'checklist', md: 'checklist' }}
      {...emptyCopy(
        state,
        'Nothing to do',
        can('task.create') ? 'Tap + to add the first task.' : 'Tasks the band adds will show up here.',
      )}
      header={header}
    >
      <TaskRows tasks={roots} boardId={boardId} />
    </SpokeList>
  );
}

const pickUp = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

/**
 * Hold a row, then drag it. The pan only activates after the long press, so
 * a plain horizontal swipe still pages to the next widget and a vertical one
 * still scrolls — the drag never steals a gesture the person meant for the
 * spoke around it.
 *
 * The new order shows at once and is held until the server's order comes back
 * (`basis` is when the list was fetched): the move mutation stays pending
 * until its refetch lands, so the list never jumps back in between. A failed
 * move drops the held order, putting the rows back where the server has them.
 */
function ReorderableTodos({
  tasks,
  boardId,
  basis,
  header,
}: {
  tasks: TaskDto[];
  boardId: string;
  basis: number;
  header: React.ReactNode;
}) {
  const canvas = usePosterCanvas();
  const reorder = useReorderTask(boardId);
  const [held, setHeld] = useState<{ ids: string[]; basis: number } | null>(null);

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = held?.basis === basis ? held.ids.flatMap((id) => byId.get(id) ?? []) : tasks;

  const move = (from: number, to: number) => {
    const plan = planMove(
      ordered.map((task) => task.id),
      from,
      to,
    );
    if (!plan) return;
    setHeld({ ids: plan.ids, basis });
    reorder.mutate(
      { taskId: plan.taskId, afterTaskId: plan.afterTaskId },
      { onError: () => setHeld(null) },
    );
  };

  // Just past Pressable's 500ms long press, per the library's guidance, so the
  // press picks the row up before the pan can claim the touch.
  const panGesture = useMemo(() => Gesture.Pan().activateAfterLongPress(520), []);
  const onDragStart = useCallback(() => {
    'worklet';
    scheduleOnRN(pickUp);
  }, []);

  return (
    <ReorderableList
      data={ordered}
      keyExtractor={(task) => task.id}
      onReorder={({ from, to }) => move(from, to)}
      panGesture={panGesture}
      onDragStart={onDragStart}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: spacing.md }}
      ListHeaderComponent={
        <>
          {header}
          <PosterText
            variant="cardMeta"
            color={canvas.soft}
            style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}
          >
            Hold a task to move it.
          </PosterText>
        </>
      }
      renderItem={({ item, index }) => (
        <DraggableTaskRow
          task={item}
          boardId={boardId}
          index={index}
          count={ordered.length}
          onMove={move}
        />
      )}
    />
  );
}

function DraggableTaskRow({
  task,
  boardId,
  index,
  count,
  onMove,
}: {
  task: TaskDto;
  boardId: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  const drag = useReorderableDrag();
  return (
    <TaskRow
      task={task}
      boardId={boardId}
      first={index === 0}
      onLongPress={drag}
      // A screen reader cannot drag; it gets the same move one step at a time.
      accessibilityActions={[
        ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
        ...(index < count - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
      ]}
      onAccessibilityAction={(action) => {
        if (action === 'moveUp') onMove(index, index - 1);
        if (action === 'moveDown') onMove(index, index + 1);
      }}
    />
  );
}

/** The caller's own tasks, soonest due first unless sorted otherwise. */
export function MyTasksSpoke({ boardId }: { boardId: string }) {
  const me = useMe(true);
  const state = useTaskView('dueDate');
  const tasks = useTasks(
    boardId,
    me.data ? taskQuery(state.view, { assigneeId: me.data.user.id }) : {},
  );
  const roots = (tasks.data ?? []).filter(
    (t) => t.parentTaskId === null && keepTask(state.view, t),
  );

  return (
    <SpokeList
      pending={tasks.isPending || me.isPending}
      error={tasks.error}
      onRetry={() => void tasks.refetch()}
      empty={roots.length === 0}
      emptyIcon={{ sf: 'person.crop.circle.badge.checkmark', md: 'assignment-ind' }}
      {...emptyCopy(
        state,
        'Nothing assigned to you',
        'Tasks someone assigns you will appear here.',
      )}
      header={
        <>
          <SpokeHeader
            boardId={boardId}
            widgetType="MY_TASKS"
            summary={openSummary(roots, 'week')}
          />
          <TaskViewControls boardId={boardId} state={state} byAssignee={false} />
        </>
      }
    >
      <TaskRows tasks={roots} boardId={boardId} />
    </SpokeList>
  );
}
