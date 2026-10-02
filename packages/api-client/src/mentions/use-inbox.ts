"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError, notify } from "../client";
import type { MentionNotificationDto } from "./types";

/**
 * The inbox: every mention addressed to the caller, across every band they are
 * in, newest first.
 *
 * Separate hooks from `use-mentions.ts` rather than a wider signature on it,
 * because they call different endpoints with different authorisation. The
 * board-scoped ones go through `BoardRolesGuard`; these hit the top-level
 * routes where the membership set *is* the boundary. Collapsing them into one
 * hook with an optional board would make "which route am I on" depend on
 * whether an argument happened to be undefined, which is not a question a
 * tenancy boundary should rest on.
 *
 * `boardId` here is a *filter*, applied by the server as an intersection with
 * the caller's membership — an id they do not belong to yields nothing rather
 * than another band's rows.
 */
const showError = (error: unknown) =>
  notify.error(error instanceof ApiError ? error.message : "Something went wrong");

/** `undefined` (no filter) and a board id are different cached lists. */
const inboxKey = (boardId?: string) => ["inbox", boardId ?? "all"];

/**
 * Invalidates both the cross-board lists and the per-board ones.
 *
 * Dismissing from the inbox has to clear the same row out of web's mentions
 * bell, and the two read different keys over the same table. Invalidating the
 * prefixes also covers every board filter at once, which matters because
 * clear-all can empty a list the user is not currently looking at.
 */
function invalidateInbox(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["inbox"] });
  void queryClient.invalidateQueries({ queryKey: ["mentions"] });
}

const query = (boardId?: string) =>
  boardId === undefined ? "" : `?boardId=${encodeURIComponent(boardId)}`;

export function useInbox(boardId?: string) {
  return useQuery({
    queryKey: inboxKey(boardId),
    queryFn: () =>
      apiFetch<MentionNotificationDto[]>(`/mentions${query(boardId)}`),
    // Matches the board-scoped hook: a mention is a notification, so it should
    // appear without the user going looking for it.
    refetchInterval: 30_000,
  });
}

export function useDismissInboxItem() {
  const queryClient = useQueryClient();
  return useMutation({
    // No board in the path: the row is addressed to the caller, and the server
    // re-derives which boards that id may belong to from live membership.
    mutationFn: (id: string) =>
      apiFetch<{ deleted: true }>(`/mentions/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateInbox(queryClient),
    onError: showError,
  });
}

/**
 * Clears the inbox — one band's worth when a filter is on, everything when it
 * is not.
 *
 * The filter is passed to the server rather than resolved client-side because
 * of the blast radius: "Clear all" while filtered to one band must not empty
 * three. The request says which it meant instead of the server guessing.
 */
export function useClearInbox(boardId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ deleted: true }>(`/mentions${query(boardId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidateInbox(queryClient),
    onError: showError,
  });
}
