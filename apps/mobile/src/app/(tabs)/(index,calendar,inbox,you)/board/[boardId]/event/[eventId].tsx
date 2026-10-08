import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { EventDetailScreen } from '@/screens/event-detail';

/** `/board/:boardId/event/:eventId` — one show, rehearsal or meeting. */
export default function EventDetail() {
  const { boardId, eventId } = useLocalSearchParams<{
    boardId: string;
    eventId: string;
  }>();

  return (
    <BoardPermissions boardId={boardId}>
      <EventDetailScreen boardId={boardId} eventId={eventId} />
    </BoardPermissions>
  );
}
