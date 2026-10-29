import { z } from 'zod';
import type { BoardRole } from '../enums';
import { WidgetTypes } from '../enums';
import { BoardPalettes, WidgetColors, type BoardPalette } from '../theme';

/**
 * One board as it appears in a list, with the caller's own role on it.
 *
 * Deliberately light: still no layout, no statuses, no members, no per-widget
 * colour slots. Those come from `GET /boards/:id` once a board is opened, so
 * listing twenty bands does not mean fetching twenty boards.
 *
 * `role` is per board. A person can be an admin of their own project and an
 * ordinary member of someone else's, so there is no such thing as "the user's
 * role" — only their role *here*.
 *
 * `palette` is the one piece of appearance that is here, and it was added
 * because leaving it out turned out to cost more than it saved. Any list of
 * bands — the switcher sheet, the calendar's filter row, a cross-board inbox
 * row — has to tell them apart, and a name alone does that poorly in a glance.
 * It is a single enum member read off the board row the query already loads, so
 * it is not the "fetching twenty themes" this comment used to warn about;
 * `widgets` is the expensive half and stays behind `GET /boards/:id`.
 */
export interface BoardSummaryDto {
  id: string;
  name: string;
  membershipId: string;
  role: BoardRole;
  /**
   * Which palette the board paints with, so a list can colour-code it the way
   * the board itself looks when opened. Normalised through `resolveBoardTheme`,
   * so an unset or unrecognised theme reads as the default rather than absent.
   */
  palette: BoardPalette;
  /** Whether the band has Band Pro (see `isPro`). */
  isPro: boolean;
  /**
   * Billing is enforced and the band lacks Pro: its routes answer 402 and the
   * apps send it to the Band Pro paywall instead of opening it.
   */
  subscriptionRequired: boolean;
}

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type UpdateBoardDto = z.infer<typeof updateBoardSchema>;

/** A new band: just its name; it starts with the default layout and statuses. */
export const createBoardSchema = updateBoardSchema;
export type CreateBoardDto = UpdateBoardDto;

/** Board-wide appearance: one predefined palette + per-widget slot picks. */
export const boardThemeSchema = z.object({
  palette: z.enum(BoardPalettes),
  widgets: z.partialRecord(z.enum(WidgetTypes), z.enum(WidgetColors)),
});
export type BoardThemeDto = z.infer<typeof boardThemeSchema>;
