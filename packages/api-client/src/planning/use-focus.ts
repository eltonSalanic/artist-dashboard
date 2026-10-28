"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "../client";
import type { FocusPeriod } from "@artist/shared";
import { apiFetch } from "../client";
import { toUserMessage } from "../messages";
import type { FocusPinDto } from "./types";

const showError = (error: unknown) =>
  notify.error(toUserMessage(error));

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
