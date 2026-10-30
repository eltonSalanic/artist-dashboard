"use client";

import { BAND_WALL_PLAN } from "@artist/shared";
import { useBoardSubscription } from "@artist/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { webCheckoutAvailable } from "@/lib/revenuecat";
import { describeSubscription, PLAN_PRICE_LINE } from "./subscription-copy";
import { SubscribeButtons } from "./subscribe-buttons";
import { ConfirmingPurchase } from "./confirming-purchase";
import { useSubscriptionCheckout } from "./use-subscription-checkout";

/**
 * The band's subscription in settings. Every member sees whose it is; only
 * the owner sees the details, because they're paying. Store purchases are
 * managed in that store, which is where RevenueCat's link sends a phone one.
 */
export function SubscriptionCard({
  boardId,
  userId,
  email,
}: {
  boardId: string;
  userId: string;
  email: string;
}) {
  const subscription = useBoardSubscription(boardId);
  const sub = subscription.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {BAND_WALL_PLAN.name} subscription
          {sub?.isPro && <Badge variant="secondary">On</Badge>}
        </CardTitle>
        <CardDescription>
          {sub?.isOwner
            ? `You own this band, so your subscription covers everyone in it: ${PLAN_PRICE_LINE}.`
            : sub?.ownerName
              ? `${sub.ownerName} owns this band, and their subscription covers everyone in it.`
              : "One subscription covers everyone in the band."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {subscription.isPending && <Skeleton className="h-10" />}
        {sub?.isOwner && <OwnerControls userId={userId} email={email} />}
      </CardContent>
    </Card>
  );
}

function OwnerControls({ userId, email }: { userId: string; email: string }) {
  const {
    subscription,
    offering,
    subscribe,
    manage,
    opening,
    awaitingPurchase,
    stuck,
    retryConfirm,
  } = useSubscriptionCheckout(userId, email);
  const sub = subscription.data;
  if (!sub) return null;

  return (
    <>
      <p className="text-sm">{describeSubscription(sub)}</p>
      {awaitingPurchase && (
        <ConfirmingPurchase stuck={stuck} onRetry={retryConfirm} />
      )}
      <div className="flex flex-wrap gap-2">
        {!sub.isPro && webCheckoutAvailable() && (
          <SubscribeButtons
            offering={offering}
            onSubscribe={(plan) => void subscribe(plan)}
            busy={opening || awaitingPurchase}
          />
        )}
        {sub.isPro && sub.store !== "PROMOTIONAL" && env.revenueCatWebKey && (
          <Button variant="outline" onClick={manage}>
            Manage subscription
          </Button>
        )}
      </div>
    </>
  );
}
