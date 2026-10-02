import { resolveBoardTheme, type BoardRole, type BoardSummaryDto } from '@artist/shared';

/**
 * One membership row as the board lists want it.
 *
 * This exists because two endpoints answer "which bands am I in" —
 * `GET /boards` and the `boards` array on `GET /me/bootstrap` — and they built
 * the same object independently. Adding `palette` to one and not the other
 * would have given the board switcher a colour and the calendar's filter row
 * none, with nothing failing to say so. One mapper means the next field cannot
 * land in only half the places.
 */
export function toBoardSummary(membership: {
  id: string;
  role: BoardRole;
  board: { id: string; name: string; theme: unknown };
}): BoardSummaryDto {
  return {
    id: membership.board.id,
    name: membership.board.name,
    membershipId: membership.id,
    role: membership.role,
    // Normalised, not passed through: the column starts life as `{}` and may
    // hold a palette written by a newer build, and a list should colour a board
    // the same way opening it does.
    palette: resolveBoardTheme(membership.board.theme).palette,
  };
}
