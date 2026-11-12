"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BoardSummaryDto,
  CreateBoardDto,
} from "@artist/shared";
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
 * Start a new band with the caller as its owner and admin. Resolves once `/me` has
 * refetched, so the new band is already in `me.boards` when the caller
 * switches to it.
 */
export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    // A name alone, or the name with the palette picked while naming it.
    mutationFn: (band: string | CreateBoardDto) =>
      apiFetch<BoardSummaryDto>("/boards", {
        method: "POST",
        body: typeof band === "string" ? { name: band } : band,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["my-subscription"] }),
      ]),
    onError: (error) =>
      notify.error(toUserMessage(error, "Couldn't create the band")),
  });
}

/**
 * Deletes the signed-in account for good (`DELETE /me`). Errors are left to
 * the screen: an `OWNS_SHARED_BANDS` 409 carries the bands to hand over first
 * (`ApiError.boards`), which it lists rather than reporting as a toast.
 *
 * The session dies with the account, so on success the caller signs out
 * locally (`auth.signOut()`); nothing here clears the query cache for it.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => apiFetch<void>("/me", { method: "DELETE" }),
  });
}
