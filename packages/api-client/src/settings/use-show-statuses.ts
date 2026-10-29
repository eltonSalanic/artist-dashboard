"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateShowStatusDto, UpdateShowStatusDto } from "@artist/shared";
import { apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";
import type { ShowStatusDto } from "../auth/types";

const showError = (error: unknown) =>
  notify.error(toUserMessage(error));

export function useShowStatuses(boardId: string) {
  return useQuery({
    queryKey: ["show-statuses", boardId],
    queryFn: () =>
      apiFetch<ShowStatusDto[]>(`/boards/${boardId}/show-statuses`),
  });
}

/**
 * A show status lives in its own list, the board detail (which the pickers
 * read), and every event and calendar item that carries its name and colour.
 */
function useInvalidateShowStatuses(boardId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["show-statuses", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["events", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["event", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
    ]);
}

export function useCreateShowStatus(boardId: string) {
  const invalidate = useInvalidateShowStatuses(boardId);
  return useMutation({
    mutationFn: (dto: CreateShowStatusDto) =>
      apiFetch<ShowStatusDto>(`/boards/${boardId}/show-statuses`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useUpdateShowStatus(boardId: string) {
  const invalidate = useInvalidateShowStatuses(boardId);
  return useMutation({
    mutationFn: ({
      statusId,
      dto,
    }: {
      statusId: string;
      dto: UpdateShowStatusDto;
    }) =>
      apiFetch<ShowStatusDto>(
        `/boards/${boardId}/show-statuses/${statusId}`,
        { method: "PATCH", body: dto },
      ),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useDeleteShowStatus(boardId: string) {
  const invalidate = useInvalidateShowStatuses(boardId);
  return useMutation({
    mutationFn: (statusId: string) =>
      apiFetch(`/boards/${boardId}/show-statuses/${statusId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}
