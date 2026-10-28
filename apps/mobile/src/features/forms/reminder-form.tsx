import { useState } from 'react';
import { router } from 'expo-router';
import {
  useCreateReminder,
  useDeleteReminder,
  usePermissions,
  useReminder,
  useUpdateReminder,
  type ReminderDto,
} from '@artist/api-client';
import { DateField } from '@/components/date-field';
import { FormGate } from './form-gate';
import { FormScreen } from './form-screen';
import { useWidgetInk } from '@/features/board/spoke-header';
import { FormPoster } from './form-poster';
import { ItemActions } from './item-actions';

/**
 * A reminder: board-wide, optionally at a moment. The moment is an instant (it
 * is when the email goes out), so it converts with `toISOString()`. No date at
 * all is valid — a standing note.
 */
export function ReminderForm({ boardId, reminderId }: { boardId: string; reminderId?: string }) {
  const { can } = usePermissions();
  const reminder = useReminder(boardId, reminderId ?? null);

  return (
    <FormGate
      allowed={can('reminder.manage')}
      pending={!!reminderId && reminder.isPending}
      missing={!!reminderId && !reminder.data}
      what="reminder"
    >
      <ReminderFields boardId={boardId} reminder={reminder.data ?? null} />
    </FormGate>
  );
}

function ReminderFields({ boardId, reminder }: { boardId: string; reminder: ReminderDto | null }) {
  const create = useCreateReminder(boardId);
  const update = useUpdateReminder(boardId);
  const remove = useDeleteReminder(boardId);

  const initial = {
    title: reminder?.title ?? '',
    remindAt: reminder?.remindAt ? new Date(reminder.remindAt) : null,
  };
  const [title, setTitle] = useState(initial.title);
  const [remindAt, setRemindAt] = useState<Date | null>(initial.remindAt);

  const iso = (d: Date | null) => d?.toISOString() ?? null;
  const dirty =
    title !== initial.title ||
    iso(remindAt) !== iso(initial.remindAt);

  const save = async () => {
    if (!reminder) {
      await create.mutateAsync({
        title: title.trim(),
        remindAt: iso(remindAt),
      });
    } else {
      await update.mutateAsync({
        reminderId: reminder.id,
        dto: {
          ...(title !== initial.title && { title: title.trim() }),
          ...(iso(remindAt) !== iso(initial.remindAt) && { remindAt: iso(remindAt) }),
        },
      });
    }
  };

  const ink = useWidgetInk(boardId, 'REMINDERS');

  return (
    <FormScreen
      title={reminder ? 'Edit reminder' : 'New reminder'}
      dirty={dirty}
      canSave={title.trim().length > 0 && (dirty || !reminder)}
      saving={create.isPending || update.isPending}
      onSave={save}
      postered
    >
      <FormPoster
        boardId={boardId}
        ink={ink}
        label={reminder ? 'Edit reminder' : 'New reminder'}
        fieldLabel="Remember to"
        placeholder="Remember to…"
        value={title}
        onChangeText={setTitle}
        autoFocus={!reminder}
        maxLength={300}
      />
      <DateField
        label="When"
        mode="datetime"
        value={remindAt}
        onChange={setRemindAt}
        emptyLabel="No date"
      />

      {reminder && (
        <ItemActions
          boardId={boardId}
          kind="REMINDER"
          id={reminder.id}
          itemLabel="reminder"
          archivedAt={reminder.archivedAt}
          canDelete
          onDelete={() => remove.mutateAsync(reminder.id)}
          onDone={() => router.back()}
        />
      )}
    </FormScreen>
  );
}
