"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "../client";
import type { UpdateCustomWidgetDto } from "@artist/shared";
import { apiFetch } from "../client";
import { toUserMessage } from "../messages";

export interface CustomWidgetDto {
  title: string;
  /** TipTap document. */
  content: Record<string, unknown>;
  updatedAt: string | null;
}

export function useCustomWidget(boardId: string) {
  return useQuery({
    queryKey: ["custom-widget", boardId],
    queryFn: () =>
      apiFetch<CustomWidgetDto>(`/boards/${boardId}/custom-widget`),
  });
}

export function useSaveCustomWidget(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateCustomWidgetDto) =>
      apiFetch<CustomWidgetDto>(`/boards/${boardId}/custom-widget`, {
        method: "PUT",
        body: dto,
      }),
    onSuccess: (data) =>
      queryClient.setQueryData(["custom-widget", boardId], data),
    onError: (error) =>
      notify.error(
        toUserMessage(error, "Could not save the note"),
      ),
  });
}
