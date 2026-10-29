"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BoardSubscriptionDto } from "@artist/shared";
import { ApiError, apiFetch } from "../client";

export const boardSubscriptionKey = (boardId: string | null | undefined) =>
  ["board-subscription", boardId] as const;

/** How often to look again while a purchase waits on RevenueCat's webhook. */
const AWAITING_PURCHASE_POLL_MS = 3_000;

/**
 * The band's subscription status. Any member may read it, and it answers even on
 * an unpaid board, so this is what decides whether to show the paywall.
 *
 * The store confirms a purchase to the app before RevenueCat's webhook
 * reaches the API, so right after buying the API can still say "not Pro".
 * Pass `awaitingPurchase` and the query polls until it flips.
 */
export function useBoardSubscription(
  boardId: string | null | undefined,
  { awaitingPurchase = false }: { awaitingPurchase?: boolean } = {},
) {
  return useQuery({
    queryKey: boardSubscriptionKey(boardId),
    queryFn: () =>
      apiFetch<BoardSubscriptionDto>(`/boards/${boardId!}/subscription`),
    enabled: !!boardId,
    refetchInterval: (query) =>
      awaitingPurchase && !query.state.data?.isPro
        ? AWAITING_PURCHASE_POLL_MS
        : false,
  });
}

/**
 * After a purchase or restore: refetch the subscription and `/me`, whose
 * board list carries the `subscriptionRequired` that decides where the apps
 * send the band.
 */
export function useRefreshBoardSubscription() {
  const queryClient = useQueryClient();
  return (boardId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: boardSubscriptionKey(boardId) }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
    ]);
}

/** A board route refused because the band has no subscription (402). */
export function isSubscriptionRequired(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 402 &&
    error.code === "BOARD_SUBSCRIPTION_REQUIRED"
  );
}
