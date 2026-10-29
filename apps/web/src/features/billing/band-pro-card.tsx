"use client";

import { BAND_PRO } from "@artist/shared";
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
import { BAND_PRO_PRICE_LINE, describeSubscription } from "./band-pro-copy";
import { useBandProCheckout } from "./use-band-pro-checkout";

/**
 * The band's Band Pro status in settings. Every member sees it; subscribing
 * and managing are for admins. Store purchases are managed in that store,
 * which is where RevenueCat's management link sends a phone purchase.
 */
export function BandProCard({
  boardId,
  email,
}: {
  boardId: string;
  email: string;
}) {
  const { can } = usePermissions();
  const { subscription, subscribe, manage, opening, awaitingPurchase } =
    useBandProCheckout(boardId, email);
  const sub = subscription.data;
  const canManage = can("billing.manage");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {BAND_PRO.name}
          {sub?.isPro && <Badge variant="secondary">On</Badge>}
        </CardTitle>
        <CardDescription>
          One subscription for the whole band: {BAND_PRO_PRICE_LINE}.
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
              <Button onClick={subscribe} disabled={opening || awaitingPurchase}>
                {opening && <Spinner data-icon="inline-start" />}
                Subscribe
              </Button>
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
