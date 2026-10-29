import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { BandProScreen } from '@/screens/band-pro';

/** `/board/:boardId/pro` — Band Pro, from the board's settings. */
export default function Pro() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  return (
    <BoardPermissions boardId={boardId} allowUnpaid>
      <BandProScreen boardId={boardId} />
    </BoardPermissions>
  );
}
