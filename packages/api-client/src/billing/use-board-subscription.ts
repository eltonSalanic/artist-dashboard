"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BoardSubscriptionDto, MySubscriptionDto } from "@artist/shared";
import { ApiError, apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";

export const boardSubscriptionKey = (boardId: string | null | undefined) =>
  ["board-subscription", boardId] as const;
export const MY_SUBSCRIPTION_KEY = ["my-subscription"] as const;

/** How often to look again while a purchase waits on RevenueCat's webhook. */
const AWAITING_PURCHASE_POLL_MS = 3_000;

/**
 * Whether a band is open, which is its owner's subscription. Any member may
 * read it, and it answers even on a locked band, so this is what says who
 * the owner is and which screen to show.
 */
export function useBoardSubscription(boardId: string | null | undefined) {
  return useQuery({
    queryKey: boardSubscriptionKey(boardId),
    queryFn: () =>
      apiFetch<BoardSubscriptionDto>(`/boards/${boardId!}/subscription`),
    enabled: !!boardId,
  });
}

/**
 * Your own subscription, and whether you can create a band.
 *
 * The store confirms a purchase to the app before RevenueCat's webhook
 * reaches the API, so right after buying the API can still say "not
 * subscribed". Pass `awaitingPurchase` and the query polls until it flips.
 */
export function useMySubscription({
  enabled = true,
  awaitingPurchase = false,
}: { enabled?: boolean; awaitingPurchase?: boolean } = {}) {
  return useQuery({
    queryKey: MY_SUBSCRIPTION_KEY,
    queryFn: () => apiFetch<MySubscriptionDto>("/me/subscription"),
    enabled,
    refetchInterval: (query) =>
      awaitingPurchase && !query.state.data?.isPro
        ? AWAITING_PURCHASE_POLL_MS
        : false,
  });
}

/**
 * After a purchase or restore: refetch your subscription, every band's, and
 * `/me`, whose board list carries the `subscriptionRequired` that decides
 * where the apps send a band.
 */
export function useRefreshSubscription() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: MY_SUBSCRIPTION_KEY }),
      queryClient.invalidateQueries({ queryKey: ["board-subscription"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
    ]);
}

/** Owner only. Forever, for everyone in the band; `name` is the typed confirmation. */
export function useDeleteBoard(boardId: string) {
  const refresh = useRefreshSubscription();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ deleted: true }>(`/boards/${boardId}`, {
        method: "DELETE",
        body: { name },
      }),
    onSuccess: () => refresh(),
    onError: (error) =>
      notify.error(toUserMessage(error, "Couldn't delete the band")),
  });
}

/** Owner only: hand the band to a member who can own it. */
export function useTransferBoard(boardId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefreshSubscription();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ ownerId: string }>(`/boards/${boardId}/transfer`, {
        method: "POST",
        body: { userId },
      }),
    onSuccess: () => {
      notify.success("Done, the band's theirs now.");
      return Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: ["board", boardId] }),
      ]);
    },
    onError: (error) =>
      notify.error(toUserMessage(error, "Couldn't hand the band over")),
  });
}

/** A board route refused because the band's owner isn't subscribed (402). */
export function isSubscriptionRequired(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 402 &&
    error.code === "BOARD_SUBSCRIPTION_REQUIRED"
  );
}
