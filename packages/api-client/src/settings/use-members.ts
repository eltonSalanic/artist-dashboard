"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RemoveMemberDto } from "@artist/shared";
import { apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";

/**
 * Members themselves arrive on `GET /boards/:id` (`useBoard().members`); this
 * is the one write. Lifted from web's settings page when the phone gained one.
 */
export function useRemoveMember(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    /**
     * `dto` says what happens to their money: where their slice of a saved
     * split goes, and an optional final payment. Left out, their slice is
     * spread over everyone else.
     */
    mutationFn: ({ userId, dto }: { userId: string; dto?: RemoveMemberDto }) =>
      apiFetch<{ removed: true }>(`/boards/${boardId}/members/${userId}`, {
        method: "DELETE",
        ...(dto ? { body: dto } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      // Their assignments go with them, so every task list is stale too.
      void queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
      // Their split and any final payment change the books.
      void queryClient.invalidateQueries({ queryKey: ["finances", boardId] });
      void queryClient.invalidateQueries({ queryKey: ["activity", boardId] });
      notify.success("Member removed");
    },
    onError: (error) =>
      notify.error(toUserMessage(error, "Remove failed")),
  });
}
