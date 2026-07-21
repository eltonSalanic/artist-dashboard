import { z } from 'zod';
import { EventTypes } from '../enums';

export const createEventSchema = z
  .object({
    type: z.enum(EventTypes),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).optional(),
    location: z.string().trim().max(300).optional(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().nullish(),
  })
  .refine((e) => !e.endsAt || e.endsAt >= e.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });
export type CreateEventDto = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    type: z.enum(EventTypes),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).nullable(),
    location: z.string().trim().max(300).nullable(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime().nullable(),
  })
  .partial();
export type UpdateEventDto = z.infer<typeof updateEventSchema>;

export const eventQuerySchema = z.object({
  type: z.enum(EventTypes).optional(),
  /** Only events starting at/after this instant. */
  from: z.iso.datetime().optional(),
  /** Only events starting before this instant. */
  to: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type EventQueryDto = z.infer<typeof eventQuerySchema>;
