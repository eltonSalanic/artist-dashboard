import { z } from 'zod';

export const createReminderSchema = z.object({
  title: z.string().trim().min(1).max(300),
  /** Optional — a reminder can be a standing note with no date attached. */
  remindAt: z.iso.datetime().nullish(),
});
export type CreateReminderDto = z.infer<typeof createReminderSchema>;

export const updateReminderSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    remindAt: z.iso.datetime().nullable(),
    done: z.boolean(),
  })
  .partial();
export type UpdateReminderDto = z.infer<typeof updateReminderSchema>;
