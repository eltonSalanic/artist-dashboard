import { z } from 'zod';

/**
 * TipTap document, stored verbatim. The shape is the editor's business, so it
 * is validated only as "a JSON object" — with a size ceiling so a runaway
 * paste can't fill the column.
 */
export const updateCustomWidgetSchema = z.object({
  title: z.string().trim().max(120).optional(),
  content: z
    .record(z.string(), z.unknown())
    .refine((doc) => JSON.stringify(doc).length <= 100_000, {
      message: 'Note is too long',
    }),
});
export type UpdateCustomWidgetDto = z.infer<typeof updateCustomWidgetSchema>;
