"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MobileLayoutItem, MobileLayoutResponse } from "@artist/shared";
import { apiFetch, ApiError, notify } from "../client";

/**
 * The phone's own arrangement of a board (P12b). Until it is saved on a phone
 * the API derives it from the web layout and says so in `source`.
 */
export const mobileLayoutKey = (boardId: string) => ["mobile-layout", boardId];

const showError = (error: unknown) =>
  notify.error(
    error instanceof ApiError ? error.message : "Couldn't save the arrangement",
  );

export function useMobileLayout(boardId: string) {
  return useQuery({
    queryKey: mobileLayoutKey(boardId),
    queryFn: () =>
      apiFetch<MobileLayoutResponse>(`/boards/${boardId}/mobile-layout`),
  });
}

export function useSaveMobileLayout(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: MobileLayoutItem[]) =>
      apiFetch<MobileLayoutResponse>(`/boards/${boardId}/mobile-layout`, {
        method: "PUT",
        body: { items },
      }),
    onSuccess: (data) => queryClient.setQueryData(mobileLayoutKey(boardId), data),
    onError: showError,
  });
}

export function useResetMobileLayout(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<MobileLayoutResponse>(`/boards/${boardId}/mobile-layout`, {
        method: "DELETE",
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(mobileLayoutKey(boardId), data);
      notify.success("Back to following your web arrangement");
    },
    onError: showError,
  });
}
