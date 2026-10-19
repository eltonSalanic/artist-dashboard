import { useMemo } from 'react';
import { router } from 'expo-router';
import { useEvents } from '@artist/api-client';
import type { EventType } from '@artist/shared';
import { Row } from '@/components/row';
import { SpokeList } from '@/components/spoke-list';
import { shortDate } from '../format';
import { EVENT_WIDGET, SpokeHeader } from '../spoke-header';

const copy: Record<EventType, { empty: string; body: string }> = {
  SHOW: { empty: 'No shows booked', body: 'Upcoming shows appear here.' },
  REHEARSAL: { empty: 'No rehearsals booked', body: 'Upcoming rehearsals appear here.' },
  MEETING: { empty: 'No meetings booked', body: 'Upcoming meetings appear here.' },
};

/**
 * Shows, rehearsals and meetings are the same list over a different
 * `Event.type` — the same factory web's registry uses, for the same reason.
 */
export function makeEventsSpoke(type: EventType) {
  return function EventsSpoke({ boardId }: { boardId: string }) {
    // Part of the query key: a fresh `new Date()` per render refetches forever.
    const from = useMemo(() => new Date().toISOString(), []);
    const events = useEvents(boardId, { type, from, limit: 50 });
    const items = events.data ?? [];

    return (
      <SpokeList
        pending={events.isPending}
        error={events.error}
        onRetry={() => void events.refetch()}
        empty={items.length === 0}
        emptyIcon={{ sf: 'calendar', md: 'event' }}
        emptyTitle={copy[type].empty}
        emptyBody={copy[type].body}
        header={
          <SpokeHeader
            boardId={boardId}
            widgetType={EVENT_WIDGET[type]}
            summary={
              items[0] ? `${items.length} upcoming · next ${shortDate(items[0].startsAt)}` : null
            }
          />
        }
      >
        {items.map((event, index) => (
          <Row
            key={event.id}
            first={index === 0}
            title={event.title}
            meta={event.location}
            trailing={shortDate(event.startsAt)}
            // Everyone, not only admins: the event's files are for the band.
            onPress={() => router.push(`/board/${boardId}/event/${event.id}`)}
          />
        ))}
      </SpokeList>
    );
  };
}
