"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MAX_ATTACHMENT_BYTES,
  type CreateAttachmentDto,
  type UploadUrlDto,
} from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import type { AttachmentDto } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Upload failed");

interface UploadUrlResponse {
  path: string;
  token: string;
  signedUrl: string;
}

interface Parent {
  taskId?: string;
  commentId?: string;
}

export function useAttachments(boardId: string, parent: Parent) {
  const key = parent.taskId
    ? `taskId=${parent.taskId}`
    : `commentId=${parent.commentId}`;
  return useQuery({
    queryKey: ["attachments", boardId, key],
    queryFn: () =>
      apiFetch<AttachmentDto[]>(`/boards/${boardId}/attachments?${key}`),
    enabled: !!(parent.taskId || parent.commentId),
  });
}

/**
 * The three-step signed-URL flow, as one mutation:
 *   1. ask the API for a signed upload token,
 *   2. PUT the bytes straight to Storage,
 *   3. persist the row (which also logs the FILE_UPLOADED activity).
 */
export function useUploadAttachment(boardId: string, parent: Parent) {
  const queryClient = useQueryClient();
  const key = parent.taskId
    ? `taskId=${parent.taskId}`
    : `commentId=${parent.commentId}`;

  return useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        throw new ApiError(400, "File is larger than the 50MB limit");
      }
      const dto: UploadUrlDto = {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      };
      const { path, signedUrl } = await apiFetch<UploadUrlResponse>(
        `/boards/${boardId}/attachments/upload-url`,
        { method: "POST", body: dto },
      );

      const put = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": dto.contentType },
        body: file,
      });
      if (!put.ok) throw new ApiError(put.status, "Storage rejected the upload");

      const create: CreateAttachmentDto = {
        storagePath: path,
        fileName: file.name,
        mimeType: dto.contentType,
        size: file.size,
        ...parent,
      };
      return apiFetch<AttachmentDto>(`/boards/${boardId}/attachments`, {
        method: "POST",
        body: create,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["attachments", boardId, key],
      });
      if (parent.commentId) {
        queryClient.invalidateQueries({ queryKey: ["comments", boardId] });
      }
      queryClient.invalidateQueries({ queryKey: ["activity", boardId] });
    },
    onError: showError,
  });
}

export function useDeleteAttachment(boardId: string, parent: Parent) {
  const queryClient = useQueryClient();
  const key = parent.taskId
    ? `taskId=${parent.taskId}`
    : `commentId=${parent.commentId}`;
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch(`/boards/${boardId}/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["attachments", boardId, key],
      }),
    onError: showError,
  });
}

/** Fetches a fresh short-lived signed URL, then triggers the browser download. */
export async function downloadAttachment(
  boardId: string,
  attachmentId: string,
) {
  try {
    const { url } = await apiFetch<{ url: string }>(
      `/boards/${boardId}/attachments/${attachmentId}/download-url`,
    );
    window.open(url, "_blank", "noopener");
  } catch (error) {
    showError(error);
  }
}
