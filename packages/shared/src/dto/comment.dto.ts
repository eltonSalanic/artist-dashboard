import { z } from 'zod';

export const createCommentSchema = z.object({
  /** Markdown source, rendered on the web side. */
  body: z.string().trim().min(1).max(10_000),
  /**
   * User ids referenced by `@name` in the body. Sent by the client rather than
   * parsed server-side so a display name that merely looks like a mention
   * never turns into one.
   */
  mentions: z.array(z.uuid()).max(20).default([]),
});
export type CreateCommentDto = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  mentions: z.array(z.uuid()).max(20).optional(),
});
export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;
