import { useState } from 'react';
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
  usePermissions,
  useSetAssignees,
  useTask,
  useUpdateTask,
  type TaskDetailDto,
} from '@artist/api-client';
import { ChoiceChips } from '@/components/choice-chips';
import { DateField } from '@/components/date-field';
import { TextField } from '@/components/text-field';
import { FormScreen } from './form-screen';
import { FormGate } from './form-gate';
import { ItemActions } from './item-actions';

const PRIORITY_CHOICES = Priorities.map((p) => ({
  value: p,
  label: p.charAt(0) + p.slice(1).toLowerCase(),
}));

/**
 * Create a task or subtask, or edit one. Editing a task's fields is an admin
 * action (`task.editFields`); creating a subtask is a member one
 * (`task.createSubtask`), with every field — the API gates the action, not the
 * fields, on create.
 */
export function TaskForm({
  boardId,
  taskId,
  parentTaskId,
}: {
  boardId: string;
  taskId?: string;
  parentTaskId?: string;
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
      />
    </FormGate>
  );
}

function TaskFields({
  boardId,
  task,
  parentTaskId,
}: {
  boardId: string;
  task: TaskDetailDto | null;
  parentTaskId?: string;
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
  };
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [priority, setPriority] = useState<Priority>(initial.priority);
  const [due, setDue] = useState<Date | null>(initial.due);
  const [assignees, setAssigneeIds] = useState<string[]>(initial.assignees);

  const dueIso = due ? dueDateFromLocalDay(due) : null;
  const initialDueIso = initial.due ? dueDateFromLocalDay(initial.due) : null;
  const assigneesChanged =
    [...assignees].sort().join() !== [...initial.assignees].sort().join();
  const dirty =
    title !== initial.title ||
    description !== initial.description ||
    priority !== initial.priority ||
    dueIso !== initialDueIso ||
    assigneesChanged;

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

  return (
    <FormScreen
      title={task ? `Edit ${label}` : `New ${label}`}
      dirty={dirty}
      canSave={title.trim().length > 0 && (dirty || !task)}
      saving={saving}
      onSave={save}
    >
      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        autoFocus={!task}
        maxLength={200}
        returnKeyType="done"
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
