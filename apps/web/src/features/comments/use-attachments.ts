"use client";

import { toast } from "sonner";
import { ApiError, fetchAttachmentUrl } from "@artist/api-client";
import type { UploadSource } from "@artist/api-client";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Upload failed");

/**
 * The browser's half of an upload: a `File` is already a fetch body. The rest
 * of the flow lives in `@artist/api-client`'s `useUploadAttachment`.
 */
export function fromFile(file: File): UploadSource {
  return {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    put: async (signedUrl, contentType) => {
      const put = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!put.ok) throw new ApiError(put.status, "Storage rejected the upload");
    },
  };
}

/** Fetches a fresh short-lived signed URL, then triggers the browser download. */
export async function downloadAttachment(
  boardId: string,
  attachmentId: string,
) {
  try {
    const { url } = await fetchAttachmentUrl(boardId, attachmentId, "download");
    window.open(url, "_blank", "noopener");
  } catch (error) {
    showError(error);
  }
}

/**
 * Fresh inline-serving signed URL for previewing an attachment in a modal
 * (no download disposition). Surfaces errors as a toast and resolves null so
 * the caller can fall back.
 */
export async function fetchViewUrl(
  boardId: string,
  attachmentId: string,
): Promise<string | null> {
  try {
    const { url } = await fetchAttachmentUrl(boardId, attachmentId, "view");
    return url;
  } catch (error) {
    showError(error);
    return null;
  }
}

/** Which mime types the in-app viewer can render inline. */
export function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/") ||
    mimeType === "application/pdf"
  );
}
