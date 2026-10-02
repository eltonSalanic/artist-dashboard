import { useReminders } from '@artist/api-client';
import { Icon } from '@/components/icon';
import { Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { shortDate } from '../format';

/** Reminders, soonest first, with standing notes (no date) at the end. */
export function RemindersSpoke({ boardId }: { boardId: string }) {
  const reminders = useReminders(boardId);
  const items = [...(reminders.data ?? [])].sort((a, b) => {
    const done = Number(a.done) - Number(b.done);
    if (done !== 0) return done;
    return (a.remindAt ?? '9999').localeCompare(b.remindAt ?? '9999');
  });
  const now = new Date();

  return (
    <SpokeList
      pending={reminders.isPending}
      error={reminders.error}
      onRetry={() => void reminders.refetch()}
      empty={items.length === 0}
      emptyIcon={{ sf: 'bell', md: 'notifications-none' }}
      emptyTitle="Nothing to remember"
      emptyBody="Reminders are board-wide — everyone sees the same list."
    >
      {items.map((reminder, index) => {
        const overdue =
          !reminder.done &&
          reminder.remindAt !== null &&
          new Date(reminder.remindAt) <= now;
        return (
          <Row
            key={reminder.id}
            first={index === 0}
            title={reminder.title}
            meta={reminder.description}
            dim={reminder.done}
            trailing={
              reminder.remindAt
                ? overdue
                  ? `${shortDate(reminder.remindAt)} · due`
                  : shortDate(reminder.remindAt)
                : 'no date'
            }
            lead={
              <Icon
                name={
                  reminder.done
                    ? { sf: 'checkmark.circle.fill', md: 'check-circle' }
                    : { sf: 'bell', md: 'notifications-none' }
                }
                size={16}
              />
            }
          />
        );
      })}
    </SpokeList>
  );
}
