import { useState } from 'react';
import { router } from 'expo-router';
import {
  dueDateFromLocalDay,
  GoalPeriods,
  localDayFromDueDate,
  type GoalPeriod,
} from '@artist/shared';
import {
  useCreateGoal,
  useDeleteGoal,
  useGoal,
  usePermissions,
  useUpdateGoal,
  type GoalDto,
} from '@artist/api-client';
import { ChoiceChips } from '@/components/choice-chips';
import { DateField } from '@/components/date-field';
import { FormGate } from './form-gate';
import { FormScreen } from './form-screen';
import { useWidgetInk } from '@/features/board/spoke-header';
import { FormPoster } from './form-poster';
import { ItemActions } from './item-actions';

// Web's labels (`goalPeriodLabel`), so a goal reads the same on both.
const PERIOD_LABEL: Record<GoalPeriod, string> = {
  YEARLY: 'Yearly',
  MONTHLY: 'Monthly',
  DAILY: 'Daily',
};

/**
 * A goal. Its target date is a calendar day, like a task's due date, so it goes
 * through the shared day rule rather than `toISOString()`. Completing it is a
 * one-tap action on the Goals spoke; here it is just the fields.
 */
export function GoalForm({ boardId, goalId }: { boardId: string; goalId?: string }) {
  const { can } = usePermissions();
  const goal = useGoal(boardId, goalId ?? null);

  return (
    <FormGate
      allowed={can('goal.manage')}
      pending={!!goalId && goal.isPending}
      missing={!!goalId && !goal.data}
      what="goal"
    >
      <GoalFields boardId={boardId} goal={goal.data ?? null} />
    </FormGate>
  );
}

function GoalFields({ boardId, goal }: { boardId: string; goal: GoalDto | null }) {
  const create = useCreateGoal(boardId);
  const update = useUpdateGoal(boardId);
  const remove = useDeleteGoal(boardId);

  const initial = {
    title: goal?.title ?? '',
    period: goal?.period ?? ('MONTHLY' as GoalPeriod),
    due: goal?.dueDate ? localDayFromDueDate(goal.dueDate) : null,
  };
  const [title, setTitle] = useState(initial.title);
  const [period, setPeriod] = useState<GoalPeriod>(initial.period);
  const [due, setDue] = useState<Date | null>(initial.due);

  const day = (d: Date | null) => (d ? dueDateFromLocalDay(d) : null);
  const dirty =
    title !== initial.title ||
    period !== initial.period ||
    day(due) !== day(initial.due);

  const save = async () => {
    if (!goal) {
      await create.mutateAsync({
        title: title.trim(),
        period,
        dueDate: day(due),
      });
    } else {
      await update.mutateAsync({
        goalId: goal.id,
        dto: {
          ...(title !== initial.title && { title: title.trim() }),
          ...(period !== initial.period && { period }),
          ...(day(due) !== day(initial.due) && { dueDate: day(due) }),
        },
      });
    }
  };

  const ink = useWidgetInk(boardId, 'GOALS');

  return (
    <FormScreen
      title={goal ? 'Edit goal' : 'New goal'}
      dirty={dirty}
      canSave={title.trim().length > 0 && (dirty || !goal)}
      saving={create.isPending || update.isPending}
      onSave={save}
      postered
    >
      <FormPoster
        ink={ink}
        label={goal ? 'Edit goal' : 'New goal'}
        fieldLabel="Goal"
        placeholder="What are you going for?"
        value={title}
        onChangeText={setTitle}
        autoFocus={!goal}
        maxLength={200}
      />
      <ChoiceChips
        label="Period"
        choices={GoalPeriods.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
        value={period}
        onChange={setPeriod}
      />
      <DateField label="Target date" value={due} onChange={setDue} />

      {goal && (
        <ItemActions
          boardId={boardId}
          kind="GOAL"
          id={goal.id}
          itemLabel="goal"
          archivedAt={goal.archivedAt}
          liveTaskCount={goal.taskCount}
          archivedTaskCount={goal.archivedTaskCount}
          linkedTaskCount={goal.linkedTaskCount}
          canDelete
          onDelete={(cascadeTasks) =>
            remove.mutateAsync({ goalId: goal.id, cascadeTasks })
          }
          onDone={() => router.back()}
        />
      )}
    </FormScreen>
  );
}
