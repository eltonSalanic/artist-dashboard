import { z } from 'zod';
import type { BoardRole } from '../enums';
import { WidgetTypes } from '../enums';
import { BoardPalettes, WidgetColors } from '../theme';

/**
 * One board as it appears in a list, with the caller's own role on it.
 *
 * Deliberately light: a board switcher needs a name and a role, not a layout
 * or a palette. Those come from `GET /boards/:id` once a board is opened, so
 * listing twenty bands does not mean fetching twenty themes.
 *
 * `role` is per board. A person can be an admin of their own project and an
 * ordinary member of someone else's, so there is no such thing as "the user's
 * role" — only their role *here*.
 */
export interface BoardSummaryDto {
  id: string;
  name: string;
  membershipId: string;
  role: BoardRole;
}

export const updateBoardSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type UpdateBoardDto = z.infer<typeof updateBoardSchema>;

/** Board-wide appearance: one predefined palette + per-widget slot picks. */
export const boardThemeSchema = z.object({
  palette: z.enum(BoardPalettes),
  widgets: z.partialRecord(z.enum(WidgetTypes), z.enum(WidgetColors)),
});
export type BoardThemeDto = z.infer<typeof boardThemeSchema>;
