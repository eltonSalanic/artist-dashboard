import type { SubscriptionStatus, SubscriptionStore } from './enums';

/**
 * The Band Wall subscription belongs to a person, and it entitles them to own
 * one band. Joining a band is free, and anyone can be in as many as they like;
 * a band stays open while its owner is subscribed. There is no free tier: with
 * BILLING_ENFORCED=true, every board route answers 402
 * `BOARD_SUBSCRIPTION_REQUIRED` while the owner isn't subscribed, and creating
 * a band needs a subscription and no band already owned (docs/billing.md).
 *
 * RevenueCat is the source of truth. The user's id is the RevenueCat app user
 * id on every platform (the phone calls `Purchases.logIn(userId)`, the web SDK
 * and purchase link carry it), so a purchase made on any store lands on the
 * same person.
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
      /** $59.99 against 12 × $5.99 ($71.88): about two months free. */
      savings: '2 months free',
    },
  },
  /**
   * Apple and Google want Terms and Privacy links on every screen that sells
   * a subscription. The pages don't exist yet; these are where they'll live.
   */
  links: {
    terms: 'https://bandwall.app/terms',
    privacy: 'https://bandwall.app/privacy',
  },
} as const;

export type SubscriptionPlan = keyof typeof BAND_WALL_PLAN.plans;

/** One person's subscription. `null` fields: no purchase yet. */
export interface SubscriptionDto {
  isPro: boolean;
  status: SubscriptionStatus | null;
  store: SubscriptionStore | null;
  productId: string | null;
  currentPeriodEnd: string | null;
  willRenew: boolean;
  /** In a free trial that ends at `currentPeriodEnd`. Counts as subscribed. */
  isTrial: boolean;
}

/**
 * What `GET /boards/:id/subscription` returns: where the band stands, which
 * is its owner's subscription. Only the owner gets the details (store, dates);
 * a member sees whether the band is open.
 */
export interface BoardSubscriptionDto extends SubscriptionDto {
  boardId: string;
  /** Billing is enforced and the owner isn't subscribed: the band is locked. */
  required: boolean;
  isOwner: boolean;
  ownerId: string | null;
  ownerName: string | null;
}

/** Why someone can't own a band right now. */
export type OwnershipBlock = 'NO_SUBSCRIPTION' | 'ALREADY_OWNS_BAND';

/** What `GET /me/subscription` returns: your own subscription. */
export interface MySubscriptionDto extends SubscriptionDto {
  /** Billing is enforced, so owning a band takes a subscription. */
  enforced: boolean;
  /** The band you own, if any. */
  ownedBoardId: string | null;
  /** Null when you can create a band right now. */
  createBlock: OwnershipBlock | null;
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
 * The RevenueCat Web Purchase Link for a person. RevenueCat takes the app user
 * id as the last path segment of the link it gives you. Null when the link is
 * not configured, so callers hide the button.
 */
export function webPurchaseUrl(
  baseUrl: string | undefined | null,
  userId: string,
): string | null {
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(userId)}`;
}
