import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { ArchiveScreen } from '@/screens/archive';

/** `/board/:boardId/archive` — what this band has put away. */
export default function Archive() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  return (
    <BoardPermissions boardId={boardId}>
      <ArchiveScreen boardId={boardId} />
    </BoardPermissions>
  );
}
