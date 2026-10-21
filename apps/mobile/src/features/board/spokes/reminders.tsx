import { router } from 'expo-router';
import { usePermissions, useReminders, useUpdateReminder } from '@artist/api-client';
import { Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { shortDate } from '../format';
import { SpokeHeader } from '../spoke-header';
import { ToggleLead } from './toggle-lead';

/** Reminders, soonest first, with standing notes (no date) at the end. */
export function RemindersSpoke({ boardId }: { boardId: string }) {
  const reminders = useReminders(boardId);
  const update = useUpdateReminder(boardId);
  const { can } = usePermissions();
  const canManage = can('reminder.manage');
  // A tick in flight shows where it is going.
  const pending = update.isPending ? update.variables : null;
  const items = [...(reminders.data ?? [])].sort((a, b) => {
    const done = Number(a.done) - Number(b.done);
    if (done !== 0) return done;
    return (a.remindAt ?? '9999').localeCompare(b.remindAt ?? '9999');
  });
  const now = new Date();
  const open = items.filter((reminder) => !reminder.done);
  const due = open.filter(
    (reminder) => reminder.remindAt !== null && new Date(reminder.remindAt) <= now,
  ).length;

  return (
    <SpokeList
      pending={reminders.isPending}
      error={reminders.error}
      onRetry={() => void reminders.refetch()}
      empty={items.length === 0}
      emptyIcon={{ sf: 'bell', md: 'notifications-none' }}
      emptyTitle="Nothing to remember"
      emptyBody="Reminders are board-wide, so everyone sees the same list."
      header={
        <SpokeHeader
          boardId={boardId}
          widgetType="REMINDERS"
          summary={items.length > 0 ? `${open.length} open${due > 0 ? ` · ${due} due` : ''}` : null}
        />
      }
    >
      {items.map((reminder, index) => {
        const done =
          pending?.reminderId === reminder.id ? (pending.dto.done ?? reminder.done) : reminder.done;
        const overdue = !done && reminder.remindAt !== null && new Date(reminder.remindAt) <= now;
        return (
          <Row
            key={reminder.id}
            first={index === 0}
            title={reminder.title}
            dim={done}
            trailing={
              reminder.remindAt
                ? overdue
                  ? `${shortDate(reminder.remindAt)} · due`
                  : shortDate(reminder.remindAt)
                : 'no date'
            }
            lead={
              <ToggleLead
                done={done}
                label={`Reminder: ${reminder.title}`}
                idle={{ sf: 'bell', md: 'notifications-none' }}
                onToggle={
                  canManage
                    ? () =>
                        update.mutate({
                          reminderId: reminder.id,
                          dto: { done: !reminder.done },
                        })
                    : undefined
                }
              />
            }
            // Open to everyone, as web's reminder modal is; Edit is on the
            // detail screen for whoever may manage reminders.
            onPress={() => router.push(`/board/${boardId}/reminder/${reminder.id}`)}
          />
        );
      })}
    </SpokeList>
  );
}
