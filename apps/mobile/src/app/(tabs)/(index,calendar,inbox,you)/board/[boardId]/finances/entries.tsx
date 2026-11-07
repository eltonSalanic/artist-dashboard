import { useLocalSearchParams } from "expo-router";
import { BoardPermissions } from "@/features/board/board-permissions";
import { FinanceEntriesScreen } from "@/screens/finance-entries";

/** `/board/:boardId/finances/entries` — every income and expense, searchable. */
export default function FinanceEntries() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  return (
    <BoardPermissions boardId={boardId}>
      <FinanceEntriesScreen boardId={boardId} />
    </BoardPermissions>
  );
}
