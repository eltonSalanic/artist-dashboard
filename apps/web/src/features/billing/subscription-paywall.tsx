"use client";

import { Sparkles } from "lucide-react";
import { BAND_PRO } from "@artist/shared";
import { usePermissions } from "@artist/api-client";
import { Spinner } from "@/components/ui/spinner";
import { webCheckoutAvailable } from "@/lib/revenuecat";
import { BAND_PRO_PRICE_LINE } from "./band-pro-copy";
import { SubscribeButtons } from "./subscribe-buttons";
import { useBandProCheckout } from "./use-band-pro-checkout";

/**
 * What a band without Band Pro sees in place of its wall, when the API
 * enforces billing. The header (and its band switcher) stays, so someone in
 * several bands can still reach the ones that are paid for.
 *
 * Buying is for admins ('billing.manage'); everyone else is told who can.
 */
export function BandProPaywall({
  boardId,
  boardName,
  email,
}: {
  boardId: string;
  boardName: string;
  email: string;
}) {
  const { can } = usePermissions();
  const { subscribe, offering, opening, awaitingPurchase } = useBandProCheckout(
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
            {boardName} needs {BAND_PRO.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {BAND_PRO.name} opens the whole wall for everyone in the band, for{" "}
            {BAND_PRO_PRICE_LINE}. One subscription covers every member.
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
