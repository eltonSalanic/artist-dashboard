import { Alert } from 'react-native';
import { useUpdateGoal, type GoalDto } from '@artist/api-client';

/**
 * Tick or untick a goal. Completing one finishes its open tasks on the server,
 * with no "goal only" option, so it asks first and says how many. Reopening
 * goes straight through.
 *
 * `pendingDone` is where an in-flight toggle is heading, so a caller can show
 * the tick before the refetch lands.
 */
export function useGoalCompletion(boardId: string) {
  const update = useUpdateGoal(boardId);

  const toggle = (goal: GoalDto) => {
    if (goal.completedAt !== null) {
      update.mutate({ goalId: goal.id, dto: { completed: false } });
      return;
    }
    const open = goal.openTaskCount;
    const noun = open === 1 ? 'task' : 'tasks';
    Alert.alert(
      'Complete this goal?',
      open > 0
        ? `"${goal.title}" still has ${open} open ${noun}. Completing the goal marks ${open === 1 ? 'it' : 'them'} done too.`
        : `"${goal.title}" will be marked complete.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: open > 0 ? `Complete goal and ${open} ${noun}` : 'Complete goal',
          onPress: () => update.mutate({ goalId: goal.id, dto: { completed: true } }),
        },
      ],
    );
  };

  const pendingDone = (goal: GoalDto) => {
    const pending = update.isPending ? update.variables : null;
    return pending?.goalId === goal.id
      ? (pending.dto.completed ?? goal.completedAt !== null)
      : goal.completedAt !== null;
  };

  return { toggle, pendingDone, isPending: update.isPending };
}
