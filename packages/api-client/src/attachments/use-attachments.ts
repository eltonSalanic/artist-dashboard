"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MAX_ATTACHMENT_BYTES,
  type CreateAttachmentDto,
  type RenameAttachmentDto,
  type UploadUrlDto,
} from "@artist/shared";
import { apiFetch, ApiError, notify } from "../client";
import type { AttachmentDto } from "../comments/types";

const showError = (error: unknown) =>
  notify.error(error instanceof ApiError ? error.message : "Upload failed");

interface UploadUrlResponse {
  path: string;
  token: string;
  signedUrl: string;
}

/** An attachment belongs to exactly one task, comment or event. */
export interface AttachmentParent {
  taskId?: string;
  commentId?: string;
  eventId?: string;
}

/**
 * A file to upload, described without saying what kind of file object it is.
 *
 * Sending the bytes is the one step that differs by platform — a browser
 * `File` is a fetch body, a phone holds a local URI that its file system
 * uploads natively — so the caller supplies `put` and everything either side
 * of it (the size cap, the signed URL, persisting the row) happens here once.
 */
export interface UploadSource {
  fileName: string;
  /** Empty when the platform could not tell; sent as octet-stream then. */
  contentType: string;
  size: number;
  /** PUTs the bytes to the signed URL, throwing if Storage refuses them. */
  put: (signedUrl: string, contentType: string) => Promise<void>;
}

const parentQuery = (parent: AttachmentParent) =>
  parent.taskId
    ? `taskId=${parent.taskId}`
    : parent.eventId
      ? `eventId=${parent.eventId}`
      : `commentId=${parent.commentId}`;

export function useAttachments(boardId: string, parent: AttachmentParent) {
  const key = parentQuery(parent);
  return useQuery({
    queryKey: ["attachments", boardId, key],
    queryFn: () =>
      apiFetch<AttachmentDto[]>(`/boards/${boardId}/attachments?${key}`),
    enabled: !!(parent.taskId || parent.commentId || parent.eventId),
  });
}

/**
 * The three-step signed-URL flow:
 *   1. ask the API for a signed upload token,
 *   2. PUT the bytes straight to Storage,
 *   3. persist the row (which also logs the FILE_UPLOADED activity).
 *
 * The path comes back from step 1 and is passed through untouched — the API
 * refuses a row whose path is not under this board.
 */
export async function uploadAttachment(
  boardId: string,
  parent: AttachmentParent,
  source: UploadSource,
): Promise<AttachmentDto> {
  if (source.size > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(400, "File is larger than the 50MB limit");
  }
  const dto: UploadUrlDto = {
    fileName: source.fileName,
    contentType: source.contentType || "application/octet-stream",
    size: source.size,
  };
  const { path, signedUrl } = await apiFetch<UploadUrlResponse>(
    `/boards/${boardId}/attachments/upload-url`,
    { method: "POST", body: dto },
  );

  await source.put(signedUrl, dto.contentType);

  const create: CreateAttachmentDto = {
    storagePath: path,
    fileName: source.fileName,
    mimeType: dto.contentType,
    size: source.size,
    ...parent,
  };
  return apiFetch<AttachmentDto>(`/boards/${boardId}/attachments`, {
    method: "POST",
    body: create,
  });
}

export function useUploadAttachment(boardId: string, parent: AttachmentParent) {
  const queryClient = useQueryClient();
  const key = parentQuery(parent);

  return useMutation({
    mutationFn: (source: UploadSource) =>
      uploadAttachment(boardId, parent, source),
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

export function useDeleteAttachment(boardId: string, parent: AttachmentParent) {
  const queryClient = useQueryClient();
  const key = parentQuery(parent);
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch(`/boards/${boardId}/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["attachments", boardId, key],
      });
      // A comment carries its attachments inline, so its list is stale too.
      if (parent.commentId) {
        queryClient.invalidateQueries({ queryKey: ["comments", boardId] });
      }
    },
    onError: showError,
  });
}

export function useRenameAttachment(boardId: string, parent: AttachmentParent) {
  const queryClient = useQueryClient();
  const key = parentQuery(parent);
  return useMutation({
    mutationFn: ({
      attachmentId,
      dto,
    }: {
      attachmentId: string;
      dto: RenameAttachmentDto;
    }) =>
      apiFetch<AttachmentDto>(
        `/boards/${boardId}/attachments/${attachmentId}`,
        { method: "PATCH", body: dto },
      ),
    // Returned, so the mutation stays pending until the new name has landed.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["attachments", boardId, key],
        }),
        ...(parent.commentId
          ? [queryClient.invalidateQueries({ queryKey: ["comments", boardId] })]
          : []),
      ]),
    onError: (error: unknown) =>
      notify.error(
        error instanceof ApiError ? error.message : "Could not rename the file",
      ),
  });
}

/** Signed links live a minute; refetch a little before that. */
const SIGNED_URL_FRESH_MS = 45_000;

/**
 * A signed URL to show an attachment, held for most of its minute so a list of
 * thumbnails does not sign every file again on each render. Disabled until
 * `enabled`, so a grid can sign only what it actually draws.
 */
export function useAttachmentUrl(
  boardId: string,
  attachmentId: string,
  kind: "view" | "download",
  enabled = true,
) {
  return useQuery({
    queryKey: ["attachment-url", boardId, attachmentId, kind],
    queryFn: () => fetchAttachmentUrl(boardId, attachmentId, kind),
    enabled,
    staleTime: SIGNED_URL_FRESH_MS,
    gcTime: SIGNED_URL_FRESH_MS,
  });
}

/**
 * A fresh short-lived signed URL for one attachment. `view` serves inline
 * under the stored content-type; `download` carries a save-as disposition.
 * Fetched at the moment of use — they expire in a minute.
 */
export function fetchAttachmentUrl(
  boardId: string,
  attachmentId: string,
  kind: "view" | "download",
) {
  return apiFetch<{ url: string; expiresIn: number }>(
    `/boards/${boardId}/attachments/${attachmentId}/${kind}-url`,
  );
}
