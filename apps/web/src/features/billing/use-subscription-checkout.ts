"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  toUserMessage,
  useMySubscription,
  useRefreshSubscription,
} from "@artist/api-client";
import {
  manageSubscriptionUrl,
  startCheckout,
  webOffering,
  type SubscriptionPlan,
} from "@/lib/revenuecat";

/**
 * Buying the subscription, which is yours rather than a band's. The store
 * confirms the purchase before RevenueCat's webhook reaches the API, so after
 * a purchase this polls your subscription until the API agrees, then refreshes
 * `/me` so the shell lets the band back in and "Create a band" opens up.
 */
export function useSubscriptionCheckout(
  userId: string,
  customerEmail?: string,
) {
  const [opening, setOpening] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const announced = useRef(false);
  // Polls while `purchased` until the API says subscribed, then stops by itself.
  const subscription = useMySubscription({ awaitingPurchase: purchased });
  const refresh = useRefreshSubscription();
  const isPro = subscription.data?.isPro ?? false;
  // Derived, not stored: the wait is over as soon as the API agrees.
  const awaitingPurchase = purchased && !isPro;
  // Whether to show RevenueCat's paywall or our own two plan buttons.
  const offering = useQuery({
    queryKey: ["subscription-web-offering", userId],
    queryFn: () => webOffering(userId),
    enabled: !isPro,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!purchased || !isPro || announced.current) return;
    announced.current = true;
    toast.success("You're subscribed. Welcome to the wall.");
    void refresh();
  }, [purchased, isPro, refresh]);

  const subscribe = async (plan: SubscriptionPlan = "monthly") => {
    setOpening(true);
    try {
      const outcome = await startCheckout(userId, plan, customerEmail);
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
      const url = await manageSubscriptionUrl(userId);
      if (url) window.open(url, "_blank", "noopener");
      else toast.error("This subscription is managed where it was bought.");
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  return {
    subscription,
    offering: offering.data ?? null,
    subscribe,
    manage,
    opening,
    awaitingPurchase,
  };
}
