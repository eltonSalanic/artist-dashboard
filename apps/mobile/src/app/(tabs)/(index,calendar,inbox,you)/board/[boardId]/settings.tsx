import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { BoardSettingsScreen } from '@/screens/board-settings';

/**
 * `/board/:boardId/settings` — notifications for everyone, the rest for admins.
 * `?section=invite` opens it scrolled to "Invite someone" (the setup card).
 */
export default function Settings() {
  const { boardId, section } = useLocalSearchParams<{ boardId: string; section?: string }>();
  return (
    <BoardPermissions boardId={boardId}>
      <BoardSettingsScreen boardId={boardId} scrollToInvite={section === 'invite'} />
    </BoardPermissions>
  );
}
