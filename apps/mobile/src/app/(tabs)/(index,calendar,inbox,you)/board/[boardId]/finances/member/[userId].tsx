import { useLocalSearchParams } from "expo-router";
import { BoardPermissions } from "@/features/board/board-permissions";
import { FinanceMemberScreen } from "@/screens/finance-member";

/** `/board/:boardId/finances/member/:userId` — one member's expenses and paybacks. */
export default function FinanceMember() {
  const { boardId, userId } = useLocalSearchParams<{
    boardId: string;
    userId: string;
  }>();
  return (
    <BoardPermissions boardId={boardId}>
      <FinanceMemberScreen boardId={boardId} userId={userId} />
    </BoardPermissions>
  );
}
