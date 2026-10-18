import { router } from 'expo-router';
import { useGoals, usePermissions } from '@artist/api-client';
import { Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { dueDay, shortDate } from '../format';
import { useGoalCompletion } from '../goal-completion';
import { SpokeHeader } from '../spoke-header';
import { ToggleLead } from './toggle-lead';

/** Goals, open ones first, each showing its period and when it is due. */
export function GoalsSpoke({ boardId }: { boardId: string }) {
  const goals = useGoals(boardId);
  const completion = useGoalCompletion(boardId);
  const { can } = usePermissions();
  const canManage = can('goal.manage');

  const all = goals.data ?? [];
  const active = all.filter((goal) => goal.completedAt === null).length;
  const items = [...all].sort((a, b) => {
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
      header={
        <SpokeHeader
          boardId={boardId}
          widgetType="GOALS"
          summary={
            all.length > 0
              ? `${active} active · ${Math.round(((all.length - active) / all.length) * 100)}% complete`
              : null
          }
        />
      }
    >
      {items.map((goal, index) => {
        const done = completion.pendingDone(goal);
        return (
          <Row
            key={goal.id}
            first={index === 0}
            title={goal.title}
            dim={done}
            trailing={goal.dueDate ? shortDate(dueDay(goal.dueDate)) : undefined}
            lead={
              <ToggleLead
                done={done}
                label={`Goal: ${goal.title}`}
                idle={{ sf: 'circle', md: 'radio-button-unchecked' }}
                onToggle={canManage ? () => completion.toggle(goal) : undefined}
              />
            }
            meta={
              goal.taskCount > 0
                ? `${goal.period.toLowerCase()} · ${goal.taskCount - goal.openTaskCount}/${goal.taskCount} tasks`
                : goal.period.toLowerCase()
            }
            // Everyone: the goal's tasks are for the band. Edit is on that screen.
            onPress={() => router.push(`/board/${boardId}/goal/${goal.id}`)}
          />
        );
      })}
    </SpokeList>
  );
}
