import { useState } from 'react';
import { router } from 'expo-router';
import { EventTypes, type EventType } from '@artist/shared';
import {
  useCreateEvent,
  useDeleteEvent,
  useEvent,
  usePermissions,
  useUpdateEvent,
  type EventDto,
} from '@artist/api-client';
import { ChoiceChips } from '@/components/choice-chips';
import { DateField } from '@/components/date-field';
import { TextField } from '@/components/text-field';
import { PosterText } from '@/components/poster-text';
import { FormGate } from './form-gate';
import { FormScreen } from './form-screen';
import { EVENT_WIDGET, useWidgetInk } from '@/features/board/spoke-header';
import { FormPoster } from './form-poster';
import { useThemeColors } from '@/theme';
import { ItemActions } from './item-actions';

const TYPE_LABEL: Record<EventType, string> = {
  SHOW: 'Show',
  REHEARSAL: 'Rehearsal',
  MEETING: 'Meeting',
};

const TYPE_PLACEHOLDER: Record<EventType, string> = {
  SHOW: 'Name the show',
  REHEARSAL: 'What are you rehearsing?',
  MEETING: "What's the meeting about?",
};

/**
 * A show, rehearsal or meeting. These are instants, not calendar days: a
 * load-in at 23:30 is that evening wherever the band is, so the picked local
 * time goes through a plain `toISOString()` — unlike a due date.
 */
export function EventForm({
  boardId,
  eventId,
  type,
}: {
  boardId: string;
  eventId?: string;
  /** The type a new event starts as — the spoke it was created from. */
  type?: EventType;
}) {
  const { can } = usePermissions();
  const event = useEvent(boardId, eventId ?? null);

  return (
    <FormGate
      allowed={can('event.manage')}
      pending={!!eventId && event.isPending}
      missing={!!eventId && !event.data}
      what={TYPE_LABEL[event.data?.type ?? type ?? 'SHOW'].toLowerCase()}
    >
      <EventFields boardId={boardId} event={event.data ?? null} initialType={type} />
    </FormGate>
  );
}

function EventFields({
  boardId,
  event,
  initialType,
}: {
  boardId: string;
  event: EventDto | null;
  initialType?: EventType;
}) {
  const create = useCreateEvent(boardId);
  const update = useUpdateEvent(boardId);
  const remove = useDeleteEvent(boardId);

  const initial = {
    type: event?.type ?? initialType ?? ('SHOW' as EventType),
    title: event?.title ?? '',
    location: event?.location ?? '',
    description: event?.description ?? '',
    startsAt: event ? new Date(event.startsAt) : null,
    endsAt: event?.endsAt ? new Date(event.endsAt) : null,
  };
  const [type, setType] = useState<EventType>(initial.type);
  const [title, setTitle] = useState(initial.title);
  const [location, setLocation] = useState(initial.location);
  const [description, setDescription] = useState(initial.description);
  const [startsAt, setStartsAt] = useState<Date | null>(initial.startsAt);
  const [endsAt, setEndsAt] = useState<Date | null>(initial.endsAt);

  const iso = (d: Date | null) => d?.toISOString() ?? null;
  const dirty =
    type !== initial.type ||
    title !== initial.title ||
    location !== initial.location ||
    description !== initial.description ||
    iso(startsAt) !== iso(initial.startsAt) ||
    iso(endsAt) !== iso(initial.endsAt);
  // The API refuses this too; saying so here keeps the person on the form.
  const endsBeforeStart = !!startsAt && !!endsAt && endsAt < startsAt;
  const label = TYPE_LABEL[type].toLowerCase();

  const save = async () => {
    if (!startsAt) return;
    if (!event) {
      await create.mutateAsync({
        type,
        title: title.trim(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        startsAt: startsAt.toISOString(),
        endsAt: iso(endsAt),
      });
    } else {
      const dto = {
        ...(type !== initial.type && { type }),
        ...(title !== initial.title && { title: title.trim() }),
        ...(location !== initial.location && { location: location.trim() || null }),
        ...(description !== initial.description && {
          description: description.trim() || null,
        }),
        ...(iso(startsAt) !== iso(initial.startsAt) && {
          startsAt: startsAt.toISOString(),
        }),
        ...(iso(endsAt) !== iso(initial.endsAt) && { endsAt: iso(endsAt) }),
      };
      await update.mutateAsync({ eventId: event.id, dto });
    }
  };

  // Follows the type chips, so switching a show to a rehearsal repaints the
  // block in Next Rehearsals' colour before it is saved.
  const ink = useWidgetInk(boardId, EVENT_WIDGET[type]);
  const colors = useThemeColors();

  return (
    <FormScreen
      title={event ? `Edit ${label}` : `New ${label}`}
      dirty={dirty}
      canSave={
        title.trim().length > 0 && !!startsAt && !endsBeforeStart && (dirty || !event)
      }
      saving={create.isPending || update.isPending}
      onSave={save}
      postered
    >
      <FormPoster
        ink={ink}
        label={event ? `Edit ${label}` : `New ${label}`}
        fieldLabel="Title"
        placeholder={TYPE_PLACEHOLDER[type]}
        value={title}
        onChangeText={setTitle}
        autoFocus={!event}
        maxLength={200}
      />
      <ChoiceChips
        label="Type"
        choices={EventTypes.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        value={type}
        onChange={setType}
      />
      <DateField
        label="Starts"
        mode="datetime"
        value={startsAt}
        onChange={setStartsAt}
        clearable={false}
      />
      <DateField label="Ends" mode="datetime" value={endsAt} onChange={setEndsAt} />
      {endsBeforeStart && (
        <PosterText variant="meta" color={colors.destructive}>
          {"It can't end before it starts."}
        </PosterText>
      )}
      <TextField
        label="Location"
        value={location}
        onChangeText={setLocation}
        maxLength={300}
      />
      <TextField
        label="Notes"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={10_000}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />

      {event && (
        <ItemActions
          boardId={boardId}
          kind="EVENT"
          id={event.id}
          itemLabel={label}
          archivedAt={event.archivedAt}
          liveTaskCount={event.taskCount}
          archivedTaskCount={event.archivedTaskCount}
          linkedTaskCount={event.linkedTaskCount}
          canDelete
          onDelete={(cascadeTasks) =>
            remove.mutateAsync({ eventId: event.id, cascadeTasks })
          }
          onDone={() => router.back()}
        />
      )}
    </FormScreen>
  );
}
