import type { SubscriptionStatus, SubscriptionStore } from './enums';

/**
 * Band Pro: one subscription per board, shared by everyone on it. There is no
 * free tier: when the API runs with BILLING_ENFORCED=true, every board route
 * answers 402 `BOARD_SUBSCRIPTION_REQUIRED` until the board has Pro
 * (docs/billing.md lists the routes that stay open).
 *
 * RevenueCat is the source of truth. The board's id is the RevenueCat app user
 * id on every platform (the phone calls `Purchases.logIn(boardId)`, the web
 * purchase link carries it), so a purchase made on any store lands on the
 * same customer and the same board.
 *
 * Store product ids are placeholders until the App Store Connect, Play Console
 * and Web Billing products exist; they must match those (docs/billing.md). Prices here are for
 * display copy only; the store always charges what the store says.
 */
export const BAND_PRO = {
  name: 'Band Pro',
  /** The RevenueCat entitlement identifier. */
  entitlement: 'band_wall',
  /**
   * Package identifiers in the RevenueCat offering. The paywalls show the
   * project's current offering, so this is for code that picks a package.
   */
  plans: {
    monthly: {
      packageId: 'monthly',
      productId: 'band_pro_monthly',
      priceCents: 599,
      currency: 'USD',
      interval: 'month',
    },
    yearly: {
      packageId: 'yearly',
      productId: 'band_pro_yearly',
      priceCents: 5999,
      currency: 'USD',
      interval: 'year',
    },
  },
} as const;

export type BandProPlan = keyof typeof BAND_PRO.plans;

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
}

/** The fields `isPro` needs, so it works on a DB row and the DTO alike. */
export interface SubscriptionLike {
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | string | null;
}

/**
 * Whether the band has Band Pro right now. Access lasts until the paid period
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
