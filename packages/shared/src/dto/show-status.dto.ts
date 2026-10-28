import { z } from 'zod';
import { ShowStatusCategories } from '../enums';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #rrggbb color');

export const createShowStatusSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: hexColor,
  category: z.enum(ShowStatusCategories),
});
export type CreateShowStatusDto = z.infer<typeof createShowStatusSchema>;

export const updateShowStatusSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    color: hexColor,
    category: z.enum(ShowStatusCategories),
    sortOrder: z.number().int().min(0),
  })
  .partial();
export type UpdateShowStatusDto = z.infer<typeof updateShowStatusSchema>;

/** Moving one show to another status — open to members ('show.changeStatus'). */
export const changeShowStatusSchema = z.object({
  showStatusId: z.uuid(),
});
export type ChangeShowStatusDto = z.infer<typeof changeShowStatusSchema>;
