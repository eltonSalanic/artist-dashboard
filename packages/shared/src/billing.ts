import type { SubscriptionStatus, SubscriptionStore } from './enums';

/**
 * The Band Wall subscription: one per board, shared by everyone on it. There is no
 * free tier: when the API runs with BILLING_ENFORCED=true, every board route
 * answers 402 `BOARD_SUBSCRIPTION_REQUIRED` until the board has Pro
 * (docs/billing.md lists the routes that stay open).
 *
 * RevenueCat is the source of truth. The board's id is the RevenueCat app user
 * id on every platform (the phone calls `Purchases.logIn(boardId)`, the web
 * purchase link carries it), so a purchase made on any store lands on the
 * same customer and the same board.
 *
 * Store product ids must match App Store Connect and Play Console
 * (docs/billing.md). Web Billing products are named in RevenueCat and reach
 * the web through the offering, so they aren't listed here. Prices here are for
 * display copy only; the store always charges what the store says.
 */
export const BAND_WALL_PLAN = {
  name: 'Band Wall',
  /** The RevenueCat entitlement identifier. */
  entitlement: 'band_wall',
  /**
   * Package identifiers in the RevenueCat offering: RevenueCat's standard
   * ones, which the SDKs also expose as `offering.monthly` and
   * `offering.annual`. The paywalls show the current offering, so this is
   * only for code that picks or orders a package.
   */
  plans: {
    monthly: {
      packageId: '$rc_monthly',
      storeProductIds: {
        appStore: 'bandwall.monthly',
        // Play subscription `bandwall_subscription`, base plan `monthly`, as
        // RevenueCat names it.
        playStore: 'bandwall_subscription:monthly',
      },
      priceCents: 599,
      currency: 'USD',
      interval: 'month',
    },
    yearly: {
      packageId: '$rc_annual',
      storeProductIds: {
        appStore: 'bandwall.yearly',
        playStore: 'bandwall_subscription:yearly',
      },
      priceCents: 5999,
      currency: 'USD',
      interval: 'year',
    },
  },
} as const;

export type SubscriptionPlan = keyof typeof BAND_WALL_PLAN.plans;

/** What `GET /boards/:id/subscription` returns. `null` fields: no purchase yet. */
export interface BoardSubscriptionDto {
  boardId: string;
  isPro: boolean;
  /** Billing is enforced and the board lacks Pro: show the paywall. */
  required: boolean;
  status: SubscriptionStatus | null;
  store: SubscriptionStore | null;
  productId: string | null;
  currentPeriodEnd: string | null;
  willRenew: boolean;
  /** In a free trial that ends at `currentPeriodEnd`. Counts as subscribed. */
  isTrial: boolean;
}

/** The fields `isPro` needs, so it works on a DB row and the DTO alike. */
export interface SubscriptionLike {
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | string | null;
}

/**
 * Whether the band is subscribed right now. Access lasts until the paid period
 * ends: a cancelled or billing-retry subscription keeps it, and the webhook
 * only flips a row to EXPIRED when RevenueCat says so. The period check is a
 * backstop for a missed EXPIRATION webhook. A null period end is a lifetime
 * promotional grant.
 */
export function isPro(
  subscription: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription?.status || subscription.status === 'EXPIRED') return false;
  if (subscription.currentPeriodEnd == null) return true;
  return new Date(subscription.currentPeriodEnd).getTime() > now.getTime();
}

/**
 * The RevenueCat Web Purchase Link for a board. RevenueCat takes the app user
 * id as the last path segment of the link it gives you. Null when the link is
 * not configured, so callers hide the button.
 */
export function webPurchaseUrl(
  baseUrl: string | undefined | null,
  boardId: string,
): string | null {
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(boardId)}`;
}
