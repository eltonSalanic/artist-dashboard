import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { TaskDetailScreen } from '@/screens/task-detail';

/** `/board/:boardId/task/:taskId` — addressable so a push can open it cold. */
export default function TaskDetail() {
  const { boardId, taskId } = useLocalSearchParams<{
    boardId: string;
    taskId: string;
  }>();

  return (
    <BoardPermissions boardId={boardId}>
      <TaskDetailScreen boardId={boardId} taskId={taskId} />
    </BoardPermissions>
  );
}
