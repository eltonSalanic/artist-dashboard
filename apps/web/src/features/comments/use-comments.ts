"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateCommentDto, UpdateCommentDto } from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import type { CommentDto } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

export function useComments(boardId: string, taskId: string | null) {
  return useQuery({
    queryKey: ["comments", boardId, taskId],
    queryFn: () =>
      apiFetch<CommentDto[]>(`/boards/${boardId}/tasks/${taskId}/comments`),
    enabled: !!taskId,
  });
}

function useInvalidateComments(boardId: string, taskId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["comments", boardId, taskId] });
    // A comment is a feed event, so the activity widget is now stale too.
    queryClient.invalidateQueries({ queryKey: ["activity", boardId] });
  };
}

export function useCreateComment(boardId: string, taskId: string) {
  const invalidate = useInvalidateComments(boardId, taskId);
  return useMutation({
    mutationFn: (dto: CreateCommentDto) =>
      apiFetch<CommentDto>(`/boards/${boardId}/tasks/${taskId}/comments`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useUpdateComment(boardId: string, taskId: string) {
  const invalidate = useInvalidateComments(boardId, taskId);
  return useMutation({
    mutationFn: ({
      commentId,
      dto,
    }: {
      commentId: string;
      dto: UpdateCommentDto;
    }) =>
      apiFetch<CommentDto>(`/boards/${boardId}/comments/${commentId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useDeleteComment(boardId: string, taskId: string) {
  const invalidate = useInvalidateComments(boardId, taskId);
  return useMutation({
    mutationFn: (commentId: string) =>
      apiFetch(`/boards/${boardId}/comments/${commentId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}
