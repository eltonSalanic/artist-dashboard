import { z } from "zod";

const MB = 1024 * 1024;

/** How big a file may be, by what kind of file it is. */
export type AttachmentSizeClass = "image" | "pdf" | "audio" | "video" | "other";

/**
 * Sized to what a normal file of each kind weighs. A compressed photo is under
 * 1 MB; a scanned rider is up to ~20 MB; a 3-minute 24-bit WAV is ~50 MB.
 * Longer video belongs on YouTube or Drive, linked rather than uploaded.
 */
export const ATTACHMENT_SIZE_LIMITS: Record<AttachmentSizeClass, number> = {
  image: 10 * MB,
  pdf: 25 * MB,
  audio: 100 * MB,
  video: 100 * MB,
  other: 25 * MB,
};

/**
 * The largest of the per-type caps. The Supabase bucket's `file_size_limit`
 * (supabase/config.toml) mirrors it so local dev refuses nothing prod accepts.
 */
export const MAX_ATTACHMENT_BYTES = Math.max(
  ...Object.values(ATTACHMENT_SIZE_LIMITS),
);

const SIZE_CLASS_LABEL: Record<AttachmentSizeClass, string> = {
  image: "Images",
  pdf: "PDFs",
  audio: "Audio files",
  video: "Videos",
  other: "Files of this type",
};

export function attachmentSizeClass(mimeType: string): AttachmentSizeClass {
  const type = mimeType.toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  return "other";
}

export function maxAttachmentBytes(mimeType: string): number {
  return ATTACHMENT_SIZE_LIMITS[attachmentSizeClass(mimeType)];
}

/** Null when the file fits its type's cap; otherwise what to tell the person. */
export function attachmentSizeError(
  mimeType: string,
  size: number,
): string | null {
  const sizeClass = attachmentSizeClass(mimeType);
  const limit = ATTACHMENT_SIZE_LIMITS[sizeClass];
  if (size <= limit) return null;
  return `${SIZE_CLASS_LABEL[sizeClass]} can be up to ${limit / MB} MB`;
}

/** A thumbnail is a ~400 px JPEG, tens of KB; anything near this is not one. */
export const MAX_THUMBNAIL_BYTES = 1 * MB;
/** Thumbnails are always this type, whatever the original was. */
export const THUMBNAIL_CONTENT_TYPE = "image/jpeg";

export const uploadUrlSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(200),
    size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
    /** Present when the client made a thumbnail and wants a URL for it too. */
    thumbnail: z
      .object({ size: z.number().int().positive().max(MAX_THUMBNAIL_BYTES) })
      .optional(),
  })
  .superRefine((dto, ctx) => {
    const message = attachmentSizeError(dto.contentType, dto.size);
    if (message) ctx.addIssue({ code: "custom", message, path: ["size"] });
  });
export type UploadUrlDto = z.infer<typeof uploadUrlSchema>;

export const createAttachmentSchema = z
  .object({
    /** Path returned by the upload-url call — never chosen by the client. */
    storagePath: z.string().min(1).max(500),
    /** The thumbnail path the upload-url call returned, if one was uploaded. */
    thumbnailPath: z.string().min(1).max(500).optional(),
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
      [dto.taskId, dto.commentId, dto.eventId, dto.financeEntryId].filter(
        Boolean,
      ).length === 1,
    {
      message:
        "An attachment belongs to exactly one task, comment, event or ledger entry",
      path: ["taskId"],
    },
  );
export type CreateAttachmentDto = z.infer<typeof createAttachmentSchema>;

/** Renaming changes what people see and what a download saves as, not the stored object. */
export const renameAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
});
export type RenameAttachmentDto = z.infer<typeof renameAttachmentSchema>;

export const attachmentViewQuerySchema = z.object({
  /** `thumb` serves the thumbnail when there is one, else the original. */
  size: z.enum(["full", "thumb"]).optional(),
});
export type AttachmentViewQueryDto = z.infer<typeof attachmentViewQuerySchema>;

export const attachmentQuerySchema = z.object({
  taskId: z.uuid().optional(),
  commentId: z.uuid().optional(),
  eventId: z.uuid().optional(),
  financeEntryId: z.uuid().optional(),
});
export type AttachmentQueryDto = z.infer<typeof attachmentQuerySchema>;
