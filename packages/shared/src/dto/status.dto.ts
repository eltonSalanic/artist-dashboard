import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #rrggbb color');

export const createStatusSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: hexColor,
  isDone: z.boolean().default(false),
});
export type CreateStatusDto = z.infer<typeof createStatusSchema>;

export const updateStatusSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    color: hexColor,
    isDone: z.boolean(),
    sortOrder: z.number().int().min(0),
  })
  .partial();
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
