"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  toUserMessage,
  useBoardSubscription,
  useRefreshBoardSubscription,
} from "@artist/api-client";
import { manageSubscriptionUrl, presentBandProPaywall } from "@/lib/revenuecat";

/**
 * Buying Band Pro for one band. The store confirms the purchase before
 * RevenueCat's webhook reaches the API, so after a purchase this polls the
 * board's subscription until the API agrees, then refreshes `/me` so the
 * shell lets the band back in.
 */
export function useBandProCheckout(boardId: string, customerEmail?: string) {
  const [opening, setOpening] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const announced = useRef(false);
  // Polls while `purchased` until the API says Pro, then stops by itself.
  const subscription = useBoardSubscription(boardId, {
    awaitingPurchase: purchased,
  });
  const refresh = useRefreshBoardSubscription();
  const isPro = subscription.data?.isPro ?? false;
  // Derived, not stored: the wait is over as soon as the API says Pro.
  const awaitingPurchase = purchased && !isPro;

  useEffect(() => {
    if (!purchased || !isPro || announced.current) return;
    announced.current = true;
    toast.success("Band Pro is on. Welcome back to the wall.");
    void refresh(boardId);
  }, [purchased, isPro, boardId, refresh]);

  const subscribe = async () => {
    setOpening(true);
    try {
      const outcome = await presentBandProPaywall(boardId, customerEmail);
      // A hosted checkout in another tab also ends in the webhook.
      if (outcome !== "cancelled") {
        announced.current = false;
        setPurchased(true);
      }
    } catch (error) {
      toast.error(toUserMessage(error, "Couldn't open checkout. Try again."));
    } finally {
      setOpening(false);
    }
  };

  const manage = async () => {
    try {
      const url = await manageSubscriptionUrl(boardId);
      if (url) window.open(url, "_blank", "noopener");
      else toast.error("This subscription is managed where it was bought.");
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  return { subscription, subscribe, manage, opening, awaitingPurchase };
}
