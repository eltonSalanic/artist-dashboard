"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BoardSummaryDto } from "@artist/shared";
import { apiFetch, notify } from "../client";
import { INLINE_ERROR, toUserMessage } from "../messages";
import type { MeResponse } from "./types";

/**
 * Bootstrap is idempotent on the API: it upserts the user, activates any
 * pending invites for the verified email, and creates a board on first login.
 */
export function useMe(enabled: boolean) {
  return useQuery({
    meta: INLINE_ERROR,
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/me/bootstrap", { method: "POST" }),
    enabled,
    staleTime: Infinity,
  });
}

/**
 * Start a new band with the caller as its admin. Resolves once `/me` has
 * refetched, so the new band is already in `me.boards` when the caller
 * switches to it.
 */
export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<BoardSummaryDto>("/boards", { method: "POST", body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
    onError: (error) =>
      notify.error(toUserMessage(error, "Couldn't create the band")),
  });
}
