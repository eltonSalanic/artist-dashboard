import { router } from 'expo-router';
import { useGoals, usePermissions, useUpdateGoal } from '@artist/api-client';
import { Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { dueDay, shortDate } from '../format';
import { ToggleLead } from './toggle-lead';

/** Goals, open ones first, each showing its period and when it is due. */
export function GoalsSpoke({ boardId }: { boardId: string }) {
  const goals = useGoals(boardId);
  const update = useUpdateGoal(boardId);
  const { can } = usePermissions();
  const canManage = can('goal.manage');
  const pending = update.isPending ? update.variables : null;
  const items = [...(goals.data ?? [])].sort((a, b) => {
    const done = Number(a.completedAt !== null) - Number(b.completedAt !== null);
    if (done !== 0) return done;
    return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
  });

  return (
    <SpokeList
      pending={goals.isPending}
      error={goals.error}
      onRetry={() => void goals.refetch()}
      empty={items.length === 0}
      emptyIcon={{ sf: 'target', md: 'track-changes' }}
      emptyTitle="No goals yet"
      emptyBody="Goals set on the web dashboard show up here."
    >
      {items.map((goal, index) => {
        const done =
          pending?.goalId === goal.id
            ? (pending.dto.completed ?? goal.completedAt !== null)
            : goal.completedAt !== null;
        return (
          <Row
            key={goal.id}
            first={index === 0}
            title={goal.title}
            meta={goal.period.toLowerCase()}
            dim={done}
            trailing={goal.dueDate ? shortDate(dueDay(goal.dueDate)) : undefined}
            lead={
              <ToggleLead
                done={done}
                label={`Goal: ${goal.title}`}
                idle={{ sf: 'circle', md: 'radio-button-unchecked' }}
                onToggle={
                  canManage
                    ? () =>
                        update.mutate({
                          goalId: goal.id,
                          dto: { completed: goal.completedAt === null },
                        })
                    : undefined
                }
              />
            }
            onPress={
              canManage
                ? () => router.push(`/board/${boardId}/form/goal?id=${goal.id}`)
                : undefined
            }
          />
        );
      })}
    </SpokeList>
  );
}
