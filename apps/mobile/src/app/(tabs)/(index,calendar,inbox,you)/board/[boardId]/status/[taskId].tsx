import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { StatusSheet } from '@/screens/status-sheet';

/** `/board/:boardId/status/:taskId` — the status picker, as a native sheet. */
export default function Status() {
  const { boardId, taskId } = useLocalSearchParams<{
    boardId: string;
    taskId: string;
  }>();

  return (
    <BoardPermissions boardId={boardId}>
      <StatusSheet boardId={boardId} taskId={taskId} />
    </BoardPermissions>
  );
}
