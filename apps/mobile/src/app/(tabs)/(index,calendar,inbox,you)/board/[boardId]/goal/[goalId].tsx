import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { GoalDetailScreen } from '@/screens/goal-detail';

/** `/board/:boardId/goal/:goalId` — one goal and its linked tasks. */
export default function GoalDetail() {
  const { boardId, goalId } = useLocalSearchParams<{
    boardId: string;
    goalId: string;
  }>();

  return (
    <BoardPermissions boardId={boardId}>
      <GoalDetailScreen boardId={boardId} goalId={goalId} />
    </BoardPermissions>
  );
}
