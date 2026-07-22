import { z } from 'zod';

/** Mirrors the 50MiB cap configured for the Supabase storage bucket. */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const uploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});
export type UploadUrlDto = z.infer<typeof uploadUrlSchema>;

export const createAttachmentSchema = z
  .object({
    /** Path returned by the upload-url call — never chosen by the client. */
    storagePath: z.string().min(1).max(500),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(200),
    size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
    taskId: z.uuid().optional(),
    commentId: z.uuid().optional(),
  })
  .refine((dto) => !!dto.taskId !== !!dto.commentId, {
    message: 'An attachment belongs to exactly one task or one comment',
    path: ['taskId'],
  });
export type CreateAttachmentDto = z.infer<typeof createAttachmentSchema>;

export const attachmentQuerySchema = z.object({
  taskId: z.uuid().optional(),
  commentId: z.uuid().optional(),
});
export type AttachmentQueryDto = z.infer<typeof attachmentQuerySchema>;
