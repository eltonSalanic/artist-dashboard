"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { FocusPeriod } from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import type { FocusPinDto } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

export function useFocus(boardId: string) {
  return useQuery({
    queryKey: ["focus", boardId],
    queryFn: () => apiFetch<FocusPinDto[]>(`/boards/${boardId}/focus`),
  });
}

export function useSetFocus(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ period, text }: { period: FocusPeriod; text: string }) =>
      apiFetch<FocusPinDto>(`/boards/${boardId}/focus/${period}`, {
        method: "PUT",
        body: { text },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["focus", boardId] }),
    onError: showError,
  });
}
