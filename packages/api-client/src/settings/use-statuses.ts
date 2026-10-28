"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateStatusDto, UpdateStatusDto } from "@artist/shared";
import { apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";
import type { TaskStatusDto } from "../auth/types";

const showError = (error: unknown) =>
  notify.error(toUserMessage(error));

export function useStatuses(boardId: string) {
  return useQuery({
    queryKey: ["statuses", boardId],
    queryFn: () => apiFetch<TaskStatusDto[]>(`/boards/${boardId}/statuses`),
  });
}

/**
 * A status lives in three places: its own list, the board detail (which the
 * status picker reads), and every task that carries its name and colour.
 */
function useInvalidateStatuses(boardId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["statuses", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["tasks", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["task", boardId] }),
    ]);
}

export function useCreateStatus(boardId: string) {
  const invalidate = useInvalidateStatuses(boardId);
  return useMutation({
    mutationFn: (dto: Omit<CreateStatusDto, "isDone"> & { isDone?: boolean }) =>
      apiFetch<TaskStatusDto>(`/boards/${boardId}/statuses`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useUpdateStatus(boardId: string) {
  const invalidate = useInvalidateStatuses(boardId);
  return useMutation({
    mutationFn: ({ statusId, dto }: { statusId: string; dto: UpdateStatusDto }) =>
      apiFetch<TaskStatusDto>(`/boards/${boardId}/statuses/${statusId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useDeleteStatus(boardId: string) {
  const invalidate = useInvalidateStatuses(boardId);
  return useMutation({
    mutationFn: (statusId: string) =>
      apiFetch(`/boards/${boardId}/statuses/${statusId}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: showError,
  });
}
