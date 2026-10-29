import type { ReactNode } from 'react';
import { PermissionsProvider, useMe } from '@artist/api-client';
import { BandProScreen } from '@/screens/band-pro';

/**
 * Permissions for the board a route names, not the board that is selected.
 *
 * The tab chrome provides the selected board's role, which was enough while
 * every screen only read. A task opened from the Calendar or the Inbox can
 * belong to a different band, and its controls must answer for *that* band —
 * an admin of their own project is an ordinary member of someone else's, and
 * vice versa. Every screen that writes, under `/board/:boardId/…`, wraps
 * itself in this.
 *
 * Not a member (removed since the link was made): least privilege. The screen
 * will show "not found" from the API's 404 anyway.
 *
 * A band without Band Pro, when the API enforces billing, gets the Band Pro
 * screen in place of the route: every board route would answer 402. The Band
 * Pro route itself passes `allowUnpaid`.
 */
export function BoardPermissions({
  boardId,
  allowUnpaid = false,
  children,
}: {
  boardId: string;
  allowUnpaid?: boolean;
  children: ReactNode;
}) {
  const me = useMe(true);
  const board = me.data?.boards.find((b) => b.id === boardId);
  const role = board?.role ?? 'USER';

  return (
    <PermissionsProvider role={role}>
      {board?.subscriptionRequired && !allowUnpaid ? (
        <BandProScreen boardId={boardId} />
      ) : (
        children
      )}
    </PermissionsProvider>
  );
}
