import { useGoals } from '@artist/api-client';
import { Icon } from '@/components/icon';
import { Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { dueDay, shortDate } from '../format';

/** Goals, open ones first, each showing its period and when it is due. */
export function GoalsSpoke({ boardId }: { boardId: string }) {
  const goals = useGoals(boardId);
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
      {items.map((goal, index) => (
        <Row
          key={goal.id}
          first={index === 0}
          title={goal.title}
          meta={goal.period.toLowerCase()}
          dim={goal.completedAt !== null}
          trailing={goal.dueDate ? shortDate(dueDay(goal.dueDate)) : undefined}
          lead={
            goal.completedAt !== null ? (
              <Icon
                name={{ sf: 'checkmark.circle.fill', md: 'check-circle' }}
                size={16}
              />
            ) : (
              <Icon name={{ sf: 'circle', md: 'radio-button-unchecked' }} size={16} />
            )
          }
        />
      ))}
    </SpokeList>
  );
}
