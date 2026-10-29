"use client";

import { BAND_WALL_PLAN } from "@artist/shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { SubscriptionPlan, WebOffering } from "@/lib/revenuecat";

const fallbackPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: BAND_WALL_PLAN.plans.monthly.currency,
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
  onSubscribe: (plan: SubscriptionPlan) => void;
  busy: boolean;
  size?: "default" | "lg";
}) {
  const prices: Record<SubscriptionPlan, string> = {
    monthly:
      offering?.prices.monthly ?? fallbackPrice(BAND_WALL_PLAN.plans.monthly.priceCents),
    yearly:
      offering?.prices.yearly ?? fallbackPrice(BAND_WALL_PLAN.plans.yearly.priceCents),
  };
  const trial = offering?.trial ?? { monthly: false, yearly: false };
  const anyTrial = trial.monthly || trial.yearly;
  // Casual on purpose: it's a band talking to bands.
  const trialNote = anyTrial ? (
    <p className="text-sm text-muted-foreground">
      First month&apos;s on us. After that it&apos;s {prices.monthly} a month
      or {prices.yearly} a year. Cancel before it&apos;s up and you won&apos;t
      pay a thing.
    </p>
  ) : null;

  if (offering?.hasPaywall) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Button size={size} onClick={() => onSubscribe("monthly")} disabled={busy}>
          {busy && <Spinner data-icon="inline-start" />}
          {anyTrial ? "Start your free month" : `Subscribe to ${BAND_WALL_PLAN.name}`}
        </Button>
        {trialNote}
      </div>
    );
  }

  const plans: { plan: SubscriptionPlan; label: string }[] = [
    { plan: "monthly", label: "Monthly" },
    { plan: "yearly", label: "Yearly" },
  ];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-2">
        {plans.map(({ plan, label }) => (
          <Button
            key={plan}
            size={size}
            variant={plan === "yearly" ? "default" : "outline"}
            onClick={() => onSubscribe(plan)}
            disabled={busy}
          >
            {trial[plan]
              ? `Start your free month · ${label}`
              : `${label} · ${prices[plan]}`}
          </Button>
        ))}
      </div>
      {trialNote}
    </div>
  );
}
