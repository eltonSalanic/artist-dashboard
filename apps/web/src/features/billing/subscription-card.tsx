"use client";

import { BAND_WALL_PLAN } from "@artist/shared";
import { usePermissions } from "@artist/api-client";
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
import { Spinner } from "@/components/ui/spinner";
import { env } from "@/lib/env";
import { webCheckoutAvailable } from "@/lib/revenuecat";
import { PLAN_PRICE_LINE, describeSubscription } from "./subscription-copy";
import { SubscribeButtons } from "./subscribe-buttons";
import { useSubscriptionCheckout } from "./use-subscription-checkout";

/**
 * The band's subscription status in settings. Every member sees it; subscribing
 * and managing are for admins. Store purchases are managed in that store,
 * which is where RevenueCat's management link sends a phone purchase.
 */
export function SubscriptionCard({
  boardId,
  email,
}: {
  boardId: string;
  email: string;
}) {
  const { can } = usePermissions();
  const { subscription, offering, subscribe, manage, opening, awaitingPurchase } =
    useSubscriptionCheckout(boardId, email);
  const sub = subscription.data;
  const canManage = can("billing.manage");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {BAND_WALL_PLAN.name} subscription
          {sub?.isPro && <Badge variant="secondary">On</Badge>}
        </CardTitle>
        <CardDescription>
          One subscription for the whole band: {PLAN_PRICE_LINE}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {subscription.isPending && <Skeleton className="h-10" />}
        {sub && <p className="text-sm">{describeSubscription(sub)}</p>}
        {awaitingPurchase && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Confirming your purchase…
          </p>
        )}
        {canManage && sub && (
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
        )}
      </CardContent>
    </Card>
  );
}
