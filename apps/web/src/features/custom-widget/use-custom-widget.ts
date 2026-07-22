"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdateCustomWidgetDto } from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";

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
      toast.error(
        error instanceof ApiError ? error.message : "Could not save the note",
      ),
  });
}
