"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import type { MentionNotificationDto } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

const key = (boardId: string) => ["mentions", boardId];

/** The current user's mention notifications, polled so new ones surface live. */
export function useMentions(boardId: string | undefined) {
  return useQuery({
    queryKey: key(boardId ?? ""),
    queryFn: () =>
      apiFetch<MentionNotificationDto[]>(`/boards/${boardId}/mentions`),
    enabled: !!boardId,
    refetchInterval: 30_000,
  });
}

export function useDismissMention(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: true }>(`/boards/${boardId}/mentions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: key(boardId) }),
    onError: showError,
  });
}

export function useClearMentions(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ deleted: true }>(`/boards/${boardId}/mentions`, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: key(boardId) }),
    onError: showError,
  });
}
