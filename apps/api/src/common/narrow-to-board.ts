/**
 * Applies an optional client-supplied board filter to the guard-resolved board
 * set, by **intersection**.
 *
 * Written as a filter rather than a substitution on purpose. The tempting form
 * is `query.boardId ?? boardIds`, which hands a client-supplied id straight
 * into the `where` clause and makes the whole authorisation depend on a
 * membership check nobody wrote. Here, an id the caller does not belong to
 * intersects to `[]`, which matches nothing — the same shape the attachments
 * query already uses for its `taskId`/`commentId` filters: ANDed on top of the
 * authorised scope, never in place of it.
 *
 * Returning `[]` rather than throwing also keeps the existing convention that a
 * board the caller cannot see is indistinguishable from a board with nothing in
 * it — `BoardRolesGuard` answers 404 for the same reason.
 */
export function narrowToBoard(
  boardIds: string[],
  boardId: string | undefined,
): string[] {
  if (!boardId) return boardIds;
  return boardIds.filter((id) => id === boardId);
}
