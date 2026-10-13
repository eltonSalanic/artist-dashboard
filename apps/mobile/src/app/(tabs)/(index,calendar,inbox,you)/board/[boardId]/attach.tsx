import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { AttachTaskScreen } from '@/screens/attach-task';

/**
 * `/board/:boardId/attach?goalId=…` (or `?eventId=…`) — pick an existing task
 * to link to that goal or event.
 */
export default function AttachTask() {
  const { boardId, goalId, eventId } = useLocalSearchParams<{
    boardId: string;
    goalId?: string;
    eventId?: string;
  }>();

  return (
    <BoardPermissions boardId={boardId}>
      <AttachTaskScreen
        boardId={boardId}
        link={goalId ? { goalId } : { eventId: eventId ?? '' }}
      />
    </BoardPermissions>
  );
}
