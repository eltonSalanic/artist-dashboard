import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { BoardSettingsScreen } from '@/screens/board-settings';

/** `/board/:boardId/settings` — notifications for everyone, the rest for admins. */
export default function Settings() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  return (
    <BoardPermissions boardId={boardId}>
      <BoardSettingsScreen boardId={boardId} />
    </BoardPermissions>
  );
}
