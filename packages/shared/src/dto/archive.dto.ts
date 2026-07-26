import { z } from 'zod';
import { ArchiveKinds } from '../enums';

export const archiveQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});
export type ArchiveQueryDto = z.infer<typeof archiveQuerySchema>;

export const archiveActionSchema = z.object({
  /**
   * Sweep the tasks linked to this event or goal along with it. Ignored for
   * kinds that own no tasks — a task's own subtasks always follow it.
   */
  cascadeTasks: z.boolean().default(false),
});
export type ArchiveActionDto = z.infer<typeof archiveActionSchema>;

export const archiveKindSchema = z.enum(ArchiveKinds);

/** Query-string twin of `archiveActionSchema`, for DELETE endpoints. */
export const cascadeQuerySchema = z.object({
  cascadeTasks: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type CascadeQueryDto = z.infer<typeof cascadeQuerySchema>;
