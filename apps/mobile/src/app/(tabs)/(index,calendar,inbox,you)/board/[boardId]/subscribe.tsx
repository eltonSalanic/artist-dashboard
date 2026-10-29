import { useLocalSearchParams } from 'expo-router';
import { BoardPermissions } from '@/features/board/board-permissions';
import { SubscriptionScreen } from '@/screens/subscription';

/** `/board/:boardId/subscribe` — the subscription screen, from the board's settings. */
export default function Pro() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  return (
    <BoardPermissions boardId={boardId} allowUnpaid>
      <SubscriptionScreen boardId={boardId} />
    </BoardPermissions>
  );
}
