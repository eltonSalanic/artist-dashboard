import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { ReminderDetailScreen } from '@/screens/reminder-detail';

/** `/board/:boardId/reminder/:reminderId` — one reminder, read in full. */
export default function ReminderDetail() {
  const { boardId, reminderId } = useLocalSearchParams<{
    boardId: string;
    reminderId: string;
  }>();

  return (
    <BoardPermissions boardId={boardId}>
      <ReminderDetailScreen boardId={boardId} reminderId={reminderId} />
    </BoardPermissions>
  );
}
