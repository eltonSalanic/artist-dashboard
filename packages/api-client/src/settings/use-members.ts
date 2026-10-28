"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";

/**
 * Members themselves arrive on `GET /boards/:id` (`useBoard().members`); this
 * is the one write. Lifted from web's settings page when the phone gained one.
 */
export function useRemoveMember(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ removed: true }>(`/boards/${boardId}/members/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      // Their assignments go with them, so every task list is stale too.
      void queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
      notify.success("Member removed");
    },
    onError: (error) =>
      notify.error(toUserMessage(error, "Remove failed")),
  });
}
