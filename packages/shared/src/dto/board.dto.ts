import { z } from 'zod';
import { WidgetTypes } from '../enums';
import { BoardPalettes, WidgetColors } from '../theme';

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
