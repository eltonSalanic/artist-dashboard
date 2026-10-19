import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  dueDateFromLocalDay,
  localDayFromDueDate,
  Priorities,
  type Priority,
} from '@artist/shared';
import {
  useBoard,
  useCreateTask,
  useDeleteTask,
  useEvent,
  useEvents,
  useGoal,
  useGoals,
  usePermissions,
  useSetAssignees,
  useTask,
  useUpdateTask,
  type TaskDetailDto,
} from '@artist/api-client';
import { ChoiceChips } from '@/components/choice-chips';
import { DateField } from '@/components/date-field';
import { PickOne, type PickOption } from '@/components/pick-one';
import { TextField } from '@/components/text-field';
import { FormScreen } from './form-screen';
import { useWidgetInk } from '@/features/board/spoke-header';
import { FormPoster } from './form-poster';
import { FormGate } from './form-gate';
import { ItemActions } from './item-actions';
import { shortDate } from '@/features/board/format';

const PRIORITY_CHOICES = Priorities.map((p) => ({
  value: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
}));

/**
 * Create a task or subtask, or edit one. Editing a task's fields is an admin
 * action (`task.editFields`); creating a subtask is a member one
 * (`task.createSubtask`), with every field — the API gates the action, not the
 * fields, on create.
 *
 * `goalId` / `eventId` start a new task already linked — the "Add" on a goal
 * or event screen.
 */
export function TaskForm({
  boardId,
  taskId,
  parentTaskId,
  goalId,
  eventId,
}: {
  boardId: string;
  taskId?: string;
  parentTaskId?: string;
  goalId?: string;
  eventId?: string;
}) {
  const { can } = usePermissions();
  const task = useTask(boardId, taskId ?? null);

  const allowed = taskId
    ? can('task.editFields')
    : can(parentTaskId ? 'task.createSubtask' : 'task.create');

  return (
    <FormGate
      allowed={allowed}
      pending={!!taskId && task.isPending}
      missing={!!taskId && !task.data}
      what={parentTaskId ? 'subtask' : 'task'}
    >
      <TaskFields
        boardId={boardId}
        task={task.data ?? null}
        parentTaskId={parentTaskId}
        goalId={goalId}
        eventId={eventId}
      />
    </FormGate>
  );
}

function TaskFields({
  boardId,
  task,
  parentTaskId,
  goalId,
  eventId,
}: {
  boardId: string;
  task: TaskDetailDto | null;
  parentTaskId?: string;
  goalId?: string;
  eventId?: string;
}) {
  const { can } = usePermissions();
  const board = useBoard(boardId);
  const create = useCreateTask(boardId);
  const update = useUpdateTask(boardId);
  const setAssignees = useSetAssignees(boardId);
  const remove = useDeleteTask(boardId);

  const initial = {
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? ('MEDIUM' as Priority),
    due: task?.dueDate ? localDayFromDueDate(task.dueDate) : null,
    assignees: task?.assignees.map((a) => a.id) ?? [],
    goal: task ? (task.goal?.id ?? null) : (goalId ?? null),
    event: task ? (task.event?.id ?? null) : (eventId ?? null),
  };
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [priority, setPriority] = useState<Priority>(initial.priority);
  const [due, setDue] = useState<Date | null>(initial.due);
  const [assignees, setAssigneeIds] = useState<string[]>(initial.assignees);
  const [goal, setGoal] = useState<string | null>(initial.goal);
  const [event, setEvent] = useState<string | null>(initial.event);
  // Linking is editing a task's fields — admin-only, as on web.
  const canLink = can('task.editFields');
  const goalOptions = useGoalOptions(boardId, initial.goal, canLink);
  const eventOptions = useEventOptions(boardId, initial.event, canLink);

  const dueIso = due ? dueDateFromLocalDay(due) : null;
  const initialDueIso = initial.due ? dueDateFromLocalDay(initial.due) : null;
  const assigneesChanged =
    [...assignees].sort().join() !== [...initial.assignees].sort().join();
  const dirty =
    title !== initial.title ||
    description !== initial.description ||
    priority !== initial.priority ||
    dueIso !== initialDueIso ||
    assigneesChanged ||
    goal !== initial.goal ||
    event !== initial.event;

  const saving = create.isPending || update.isPending || setAssignees.isPending;
  const label = task?.parentTaskId || parentTaskId ? 'subtask' : 'task';

  // Resolves once saved; rejects (already reported by the hook) to keep the
  // form open. FormScreen closes it.
  const save = async () => {
    if (!task) {
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueIso,
        assigneeIds: assignees,
        parentTaskId,
        goalId: goal ?? undefined,
        eventId: event ?? undefined,
      });
    } else {
      // Only what changed: a PATCH carrying every field would log an
      // activity entry for edits nobody made.
      const dto = {
        ...(title !== initial.title && { title: title.trim() }),
        ...(description !== initial.description && {
          description: description.trim() || null,
        }),
        ...(priority !== initial.priority && { priority }),
        ...(dueIso !== initialDueIso && { dueDate: dueIso }),
        ...(goal !== initial.goal && { goalId: goal }),
        ...(event !== initial.event && { eventId: event }),
      };
      if (Object.keys(dto).length > 0) {
        await update.mutateAsync({ taskId: task.id, dto });
      }
      if (assigneesChanged) {
        await setAssignees.mutateAsync({ taskId: task.id, assigneeIds: assignees });
      }
    }
  };

  const members = board.data?.members ?? [];
  const ink = useWidgetInk(boardId, 'TODOS');

  return (
    <FormScreen
      title={task ? `Edit ${label}` : `New ${label}`}
      dirty={dirty}
      canSave={title.trim().length > 0 && (dirty || !task)}
      saving={saving}
      onSave={save}
      postered
    >
      <FormPoster
        ink={ink}
        label={task ? `Edit ${label}` : `New ${label}`}
        fieldLabel="Title"
        placeholder="What needs doing?"
        value={title}
        onChangeText={setTitle}
        autoFocus={!task}
        maxLength={200}
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={10_000}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <ChoiceChips
        label="Priority"
        choices={PRIORITY_CHOICES}
        value={priority}
        onChange={setPriority}
      />
      <DateField label="Due" value={due} onChange={setDue} />
      {/* Assigning on create is part of the create call, which a member may
          make for a subtask; changing assignees later is admin-only. */}
      {members.length > 0 && (!task || can('task.editFields')) && (
        <ChoiceChips
          label="Assigned to"
          multiple
          choices={members.map((m) => ({ value: m.userId, label: m.displayName }))}
          value={assignees}
          onChange={setAssigneeIds}
        />
      )}
      {canLink && (
        <>
          <PickOne
            label="Goal"
            noneLabel="No goal"
            options={goalOptions}
            value={goal}
            onChange={setGoal}
          />
          <PickOne
            label="Show or event"
            noneLabel="No show or event"
            options={eventOptions}
            value={event}
            onChange={setEvent}
          />
        </>
      )}

      {task && (
        <ItemActions
          boardId={boardId}
          kind="TASK"
          id={task.id}
          itemLabel={label}
          archivedAt={task.archivedAt}
          canDelete={can('task.delete')}
          onDelete={() => remove.mutateAsync(task.id)}
          // Past the task screen too: it is for a task that is now gone or
          // archived, and would only show "not found".
          onDone={() => router.dismiss(2)}
        />
      )}
    </FormScreen>
  );
}

/**
 * Open goals, the ones a task is worth linking to. The linked goal stays in
 * the list even once finished (fetched on its own if need be), or the picker
 * could not say what the task is linked to.
 */
function useGoalOptions(
  boardId: string,
  current: string | null,
  enabled: boolean,
): PickOption[] {
  const goals = useGoals(boardId, { includeCompleted: false });
  const listed = (goals.data ?? []).some((g) => g.id === current);
  const extra = useGoal(boardId, enabled && current && goals.data && !listed ? current : null);
  if (!enabled) return [];
  const options: PickOption[] = (goals.data ?? []).map((g) => ({
    value: g.id,
    label: g.title,
    meta: g.period.toLowerCase(),
  }));
  if (!listed && extra.data) {
    options.unshift({
      value: extra.data.id,
      label: extra.data.title,
      meta: extra.data.completedAt ? 'completed' : extra.data.period.toLowerCase(),
    });
  }
  return options;
}

/**
 * Upcoming shows, rehearsals and meetings, soonest first — a band's whole
 * history would bury next week's gig. A past event the task is linked to stays
 * at the top, for the same reason as a finished goal.
 */
function useEventOptions(
  boardId: string,
  current: string | null,
  enabled: boolean,
): PickOption[] {
  // Part of the query key: a fresh `new Date()` per render refetches forever.
  const from = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
  }, []);
  const events = useEvents(boardId, { from, limit: 50 });
  const listed = (events.data ?? []).some((e) => e.id === current);
  const extra = useEvent(boardId, enabled && current && events.data && !listed ? current : null);
  if (!enabled) return [];
  const option = (e: { id: string; title: string; type: string; startsAt: string }) => ({
    value: e.id,
    label: e.title,
    meta: `${e.type.toLowerCase()} · ${shortDate(e.startsAt)}`,
  });
  const options: PickOption[] = (events.data ?? []).map(option);
  if (!listed && extra.data) options.unshift(option(extra.data));
  return options;
}
