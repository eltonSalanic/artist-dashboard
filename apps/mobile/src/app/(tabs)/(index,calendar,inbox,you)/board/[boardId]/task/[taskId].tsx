import { useLocalSearchParams } from 'expo-router';
import { TaskDetailScreen } from '@/screens/task-detail';

/** `/board/:boardId/task/:taskId` — addressable so a push can open it cold. */
export default function TaskDetail() {
  const { boardId, taskId } = useLocalSearchParams<{
    boardId: string;
    taskId: string;
  }>();

  return <TaskDetailScreen boardId={boardId} taskId={taskId} />;
}
