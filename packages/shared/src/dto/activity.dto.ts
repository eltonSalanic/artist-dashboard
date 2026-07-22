import { z } from 'zod';

export const ACTIVITY_PAGE_SIZE = 20;

export const activityQuerySchema = z.object({
  /** Id of the last item on the previous page; omit for the first page. */
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(ACTIVITY_PAGE_SIZE),
});
export type ActivityQueryDto = z.infer<typeof activityQuerySchema>;
