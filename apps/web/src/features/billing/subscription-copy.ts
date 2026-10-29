import { BAND_WALL_PLAN, type BoardSubscriptionDto } from "@artist/shared";

const price = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: BAND_WALL_PLAN.plans.monthly.currency,
  }).format(cents / 100);

/** "$5.99 a month or $59.99 a year". Display copy; the store charges its own. */
export const PLAN_PRICE_LINE = `${price(BAND_WALL_PLAN.plans.monthly.priceCents)} a month or ${price(BAND_WALL_PLAN.plans.yearly.priceCents)} a year`;

const STATUS_COPY: Record<NonNullable<BoardSubscriptionDto["status"]>, string> = {
  ACTIVE: "Active",
  GRACE: "Payment problem, still on while the store retries",
  CANCELLED: "Cancelled, on until the end of the paid period",
  EXPIRED: "Expired",
};

const STORE_COPY: Record<NonNullable<BoardSubscriptionDto["store"]>, string> = {
  APP_STORE: "the App Store",
  PLAY_STORE: "Google Play",
  STRIPE: "the web",
  PROMOTIONAL: "a promotional grant",
};

/** One line describing the band's subscription, for settings. */
export function describeSubscription(sub: BoardSubscriptionDto): string {
  if (!sub.status) return "Not subscribed.";
  const parts = [STATUS_COPY[sub.status]];
  if (sub.store) parts.push(`via ${STORE_COPY[sub.store]}`);
  if (sub.currentPeriodEnd && sub.status !== "EXPIRED") {
    const date = new Date(sub.currentPeriodEnd).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
    parts.push(sub.willRenew ? `renews ${date}` : `ends ${date}`);
  }
  return `${parts.join(", ")}.`;
}
