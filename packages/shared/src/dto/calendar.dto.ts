import { z } from 'zod';

export const calendarQuerySchema = z
  .object({
    /** Inclusive start of the visible range. */
    from: z.iso.datetime(),
    /** Exclusive end of the visible range. */
    to: z.iso.datetime(),
  })
  .refine((q) => q.to > q.from, {
    message: 'to must be after from',
    path: ['to'],
  });
export type CalendarQueryDto = z.infer<typeof calendarQuerySchema>;
