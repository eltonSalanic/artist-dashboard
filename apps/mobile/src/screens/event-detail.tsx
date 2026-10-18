import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useEvent, usePermissions } from '@artist/api-client';
import type { EventType, WidgetType } from '@artist/shared';
import { PosterText } from '@/components/poster-text';
import { TaskAttachments } from '@/features/attachments/task-attachments';
import {
  DetailLoading,
  DetailMissing,
  DetailPoster,
  HeaderEdit,
  PosterMeta,
} from '@/features/board/detail-poster';
import { daysAway, timeOfDay } from '@/features/board/format';
import { useWidgetInk } from '@/features/board/spoke-header';
import { LinkedTasks } from '@/features/links/linked-tasks';
import { spacing, useThemeColors } from '@/theme';

const TYPE_TITLE = { SHOW: 'Show', REHEARSAL: 'Rehearsal', MEETING: 'Meeting' } as const;

/** The widget each kind of event lives in: its colour here and on the calendar. */
const TYPE_WIDGET: Record<EventType, WidgetType> = {
  SHOW: 'SHOWS',
  REHEARSAL: 'NEXT_REHEARSALS',
  MEETING: 'NEXT_MEETINGS',
};

/**
 * One show, rehearsal or meeting: when, where, the notes, its tasks, and its
 * files.
 *
 * It exists for the files. A show's rider, stage plot and setlist are what
 * the whole band needs on the day, and before this the only way into an event
 * on the phone was the admin's edit form, so a member could not reach them.
 * Read-only otherwise; Edit in the header opens that form for whoever may
 * change events. Wrapped by its route in `BoardPermissions`.
 *
 * The top is a poster for the date, in its widget's colour: the day set huge
 * as on the calendar, and how far off it is in the corner — so a meeting that
 * has already happened says so, rather than looking like the next one.
 */
export function EventDetailScreen({ boardId, eventId }: { boardId: string; eventId: string }) {
  const colors = useThemeColors();
  const event = useEvent(boardId, eventId);
  const { can } = usePermissions();
  // Until the event lands its type is unknown; Shows is only a placeholder,
  // and the loading state paints no block with it.
  const ink = useWidgetInk(boardId, TYPE_WIDGET[event.data?.type ?? 'SHOW']);

  if (event.isPending) return <DetailLoading />;

  if (event.isError || !event.data) {
    return (
      <DetailMissing what="Event" reason="It may have been deleted, or belong to another band." />
    );
  }

  const e = event.data;
  const kind = TYPE_TITLE[e.type];
  const starts = new Date(e.startsAt);
  // An end equal to the start is "no end set", not a zero-length show.
  const time =
    e.endsAt && e.endsAt !== e.startsAt
      ? `${timeOfDay(e.startsAt)} – ${timeOfDay(e.endsAt)}`
      : timeOfDay(e.startsAt);
  const sameYear = starts.getFullYear() === new Date().getFullYear();
  const dayLabel = starts
    .toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    })
    .toUpperCase();

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: can('event.manage')
            ? () => (
                <HeaderEdit
                  label={`Edit ${kind.toLowerCase()}`}
                  onPress={() => router.push(`/board/${boardId}/form/event?id=${e.id}`)}
                />
              )
            : undefined,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
      >
        <DetailPoster
          ink={ink}
          label={kind}
          aside={e.archivedAt ? 'Archived' : daysAway(e.startsAt)}
          title={e.title}
        >
          <View
            accessible
            accessibilityLabel={`${starts.toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              ...(sameYear ? {} : { year: 'numeric' }),
            })}, ${time}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <PosterText variant="figure" color={ink.ink}>
              {starts.getDate()}
            </PosterText>
            <View style={{ flex: 1, gap: 2 }}>
              <PosterText variant="label" color={ink.ink}>
                {dayLabel}
              </PosterText>
              <PosterMeta ink={ink}>{time}</PosterMeta>
            </View>
          </View>
          {e.location ? <PosterMeta ink={ink}>{e.location}</PosterMeta> : null}
        </DetailPoster>

        {e.description !== null && e.description.trim() !== '' && (
          <PosterText variant="paragraph" color={colors.foreground}>
            {e.description}
          </PosterText>
        )}

        <LinkedTasks boardId={boardId} link={{ eventId: e.id }} archived={e.archivedAt !== null} />

        <TaskAttachments boardId={boardId} parent={{ eventId: e.id }} />
      </ScrollView>
    </>
  );
}
