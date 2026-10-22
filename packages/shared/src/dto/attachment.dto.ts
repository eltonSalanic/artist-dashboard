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
    eventId: z.uuid().optional(),
    /** A receipt on a ledger entry. */
    financeEntryId: z.uuid().optional(),
  })
  .refine(
    (dto) =>
      [dto.taskId, dto.commentId, dto.eventId, dto.financeEntryId].filter(Boolean)
        .length === 1,
    {
      message:
        'An attachment belongs to exactly one task, comment, event or ledger entry',
      path: ['taskId'],
    },
  );
export type CreateAttachmentDto = z.infer<typeof createAttachmentSchema>;

/** Renaming changes what people see and what a download saves as, not the stored object. */
export const renameAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
});
export type RenameAttachmentDto = z.infer<typeof renameAttachmentSchema>;

export const attachmentQuerySchema = z.object({
  taskId: z.uuid().optional(),
  commentId: z.uuid().optional(),
  eventId: z.uuid().optional(),
  financeEntryId: z.uuid().optional(),
});
export type AttachmentQueryDto = z.infer<typeof attachmentQuerySchema>;
