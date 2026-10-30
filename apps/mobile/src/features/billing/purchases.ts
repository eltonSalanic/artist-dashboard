import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { BAND_WALL_PLAN } from '@artist/shared';
import { env } from '@/lib/env';

/**
 * RevenueCat on the phone. The subscription belongs to the person, so before
 * anything is bought or restored the SDK is logged in as the user's id, the
 * same app user id the web checkout and the API's webhook use.
 *
 * Configured lazily, on the subscription screen, so a build without a key (or a
 * person who never opens the screen) never starts the SDK.
 */
let configured = false;

export const billingAvailable = () => !!env.revenueCatKey;

async function ready(userId: string) {
  if (!env.revenueCatKey) throw new Error("Subscriptions aren't set up in this build.");
  if (!configured) {
    Purchases.configure({ apiKey: env.revenueCatKey, appUserID: userId });
    configured = true;
  } else if ((await Purchases.getAppUserID()) !== userId) {
    await Purchases.logIn(userId);
  }
}

const hasPro = (info: { entitlements: { active: Record<string, unknown> } }) =>
  BAND_WALL_PLAN.entitlement in info.entitlements.active;

export interface PlanOption {
  pkg: PurchasesPackage;
  /** The plan has a free trial this store account can still get. */
  freeTrial: boolean;
}

/**
 * The packages in the current offering, monthly first, each with whether its
 * free trial is on the table. Trial eligibility belongs to the Apple ID or
 * Google account (per subscription group), so one person gets one free
 * month, across every band they ever own.
 *
 * Android only lists a free phase to an eligible account. iOS lists the
 * intro offer to everyone and answers eligibility separately; "unknown"
 * (Apple couldn't tell) still shows the trial, and the store's own sheet
 * states the real terms before anyone pays.
 */
export async function planPackages(userId: string): Promise<PlanOption[]> {
  await ready(userId);
  const offerings = await Purchases.getOfferings();
  const order: string[] = [BAND_WALL_PLAN.plans.monthly.packageId, BAND_WALL_PLAN.plans.yearly.packageId];
  const packages = [...(offerings.current?.availablePackages ?? [])].sort(
    (a, b) => rank(order, a.identifier) - rank(order, b.identifier),
  );

  const eligibility =
    process.env.EXPO_OS === 'ios'
      ? await Purchases.checkTrialOrIntroductoryPriceEligibility(
          packages.map((p) => p.product.identifier),
        )
      : {};
  return packages.map((pkg) => {
    const { product } = pkg;
    const hasTrial = product.introPrice?.price === 0 || !!product.defaultOption?.freePhase;
    const status = eligibility[product.identifier]?.status;
    return {
      pkg,
      freeTrial: hasTrial && status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE,
    };
  });
}

const rank = (order: string[], id: string) => {
  const index = order.indexOf(id);
  return index === -1 ? order.length : index;
};

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'not_entitled';

/** Buys one package. Backing out of the store sheet is not an error. */
export async function buySubscription(
  userId: string,
  pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  await ready(userId);
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return hasPro(customerInfo) ? 'purchased' : 'not_entitled';
  } catch (error) {
    if ((error as PurchasesError).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return 'cancelled';
    }
    throw error;
  }
}

/** Restores this store account's purchases onto this person. */
export async function restoreSubscription(userId: string): Promise<boolean> {
  await ready(userId);
  return hasPro(await Purchases.restorePurchases());
}

/** RevenueCat's Customer Center: cancel, change plan, request a refund. */
export async function manageSubscription(userId: string): Promise<void> {
  await ready(userId);
  await RevenueCatUI.presentCustomerCenter();
}
