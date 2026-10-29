"use client";

import { BAND_PRO } from "@artist/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { BandProPlan, WebOffering } from "@/lib/revenuecat";

const fallbackPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: BAND_PRO.plans.monthly.currency,
  }).format(cents / 100);

/**
 * One Subscribe button when RevenueCat has a paywall for the offering (the
 * person picks a plan there), otherwise one button per plan, priced from the
 * store when the offering has loaded.
 */
export function SubscribeButtons({
  offering,
  onSubscribe,
  busy,
  size,
}: {
  offering: WebOffering | null;
  onSubscribe: (plan: BandProPlan) => void;
  busy: boolean;
  size?: "default" | "lg";
}) {
  if (offering?.hasPaywall) {
    return (
      <Button size={size} onClick={() => onSubscribe("monthly")} disabled={busy}>
        {busy && <Spinner data-icon="inline-start" />}
        Subscribe to {BAND_PRO.name}
      </Button>
    );
  }

  const plans: { plan: BandProPlan; label: string; price: string }[] = [
    {
      plan: "monthly",
      label: "Monthly",
      price: offering?.prices.monthly ?? fallbackPrice(BAND_PRO.plans.monthly.priceCents),
    },
    {
      plan: "yearly",
      label: "Yearly",
      price: offering?.prices.yearly ?? fallbackPrice(BAND_PRO.plans.yearly.priceCents),
    },
  ];
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {plans.map(({ plan, label, price }) => (
        <Button
          key={plan}
          size={size}
          variant={plan === "yearly" ? "default" : "outline"}
          onClick={() => onSubscribe(plan)}
          disabled={busy}
        >
          {label} · {price}
        </Button>
      ))}
    </div>
  );
}
