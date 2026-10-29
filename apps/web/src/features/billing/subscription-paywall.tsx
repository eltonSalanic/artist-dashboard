"use client";

import { Sparkles } from "lucide-react";
import { BAND_WALL_PLAN } from "@artist/shared";
import { usePermissions } from "@artist/api-client";
import { Spinner } from "@/components/ui/spinner";
import { webCheckoutAvailable } from "@/lib/revenuecat";
import { PLAN_PRICE_LINE } from "./subscription-copy";
import { SubscribeButtons } from "./subscribe-buttons";
import { useSubscriptionCheckout } from "./use-subscription-checkout";

/**
 * What a band without a subscription sees in place of its wall, when the API
 * enforces billing. The header (and its band switcher) stays, so someone in
 * several bands can still reach the ones that are paid for.
 *
 * Buying is for admins ('billing.manage'); everyone else is told who can.
 */
export function SubscriptionPaywall({
  boardId,
  boardName,
  email,
}: {
  boardId: string;
  boardName: string;
  email: string;
}) {
  const { can } = usePermissions();
  const { subscribe, offering, opening, awaitingPurchase } = useSubscriptionCheckout(
    boardId,
    email,
  );
  const canBuy = can("billing.manage");
  const available = webCheckoutAvailable();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            {boardName} needs a {BAND_WALL_PLAN.name} subscription
          </h1>
          <p className="text-sm text-muted-foreground">
            A {BAND_WALL_PLAN.name} subscription opens the whole wall for everyone in the band, for{" "}
            {PLAN_PRICE_LINE}. One subscription covers every member.
          </p>
        </div>

        {awaitingPurchase ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Confirming your purchase…
          </p>
        ) : canBuy && available ? (
          <SubscribeButtons
            size="lg"
            offering={offering}
            onSubscribe={(plan) => void subscribe(plan)}
            busy={opening}
          />
        ) : canBuy ? (
          <p className="text-sm text-muted-foreground">
            Subscribe from the Band Wall app on your phone.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask one of the band&apos;s admins to subscribe.
          </p>
        )}
      </div>
    </main>
  );
}
