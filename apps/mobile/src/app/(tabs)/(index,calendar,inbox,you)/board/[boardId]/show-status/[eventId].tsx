import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { ShowStatusSheet } from '@/screens/show-status-sheet';

/** `/board/:boardId/show-status/:eventId` — the show status picker, as a native sheet. */
export default function ShowStatus() {
  const { boardId, eventId } = useLocalSearchParams<{
    boardId: string;
    eventId: string;
  }>();

  return (
    <BoardPermissions boardId={boardId}>
      <ShowStatusSheet boardId={boardId} eventId={eventId} />
    </BoardPermissions>
  );
}
