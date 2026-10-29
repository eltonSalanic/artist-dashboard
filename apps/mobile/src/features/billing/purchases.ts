import Purchases, {
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { BAND_WALL_PLAN } from '@artist/shared';
import { env } from '@/lib/env';

/**
 * RevenueCat on the phone. the subscription belongs to the board, so before anything
 * is bought or restored the SDK is logged in as the board's id, the same app
 * user id the web checkout and the API's webhook use.
 *
 * Configured lazily, on the subscription screen, so a build without a key (or a
 * person who never opens the screen) never starts the SDK.
 */
let configured = false;

export const billingAvailable = () => !!env.revenueCatKey;

async function ready(boardId: string) {
  if (!env.revenueCatKey) throw new Error("Subscriptions aren't set up in this build.");
  if (!configured) {
    Purchases.configure({ apiKey: env.revenueCatKey, appUserID: boardId });
    configured = true;
  } else if ((await Purchases.getAppUserID()) !== boardId) {
    await Purchases.logIn(boardId);
  }
}

const hasPro = (info: { entitlements: { active: Record<string, unknown> } }) =>
  BAND_WALL_PLAN.entitlement in info.entitlements.active;

/** The packages in the current offering, monthly first. */
export async function planPackages(boardId: string): Promise<PurchasesPackage[]> {
  await ready(boardId);
  const offerings = await Purchases.getOfferings();
  const order: string[] = [BAND_WALL_PLAN.plans.monthly.packageId, BAND_WALL_PLAN.plans.yearly.packageId];
  return [...(offerings.current?.availablePackages ?? [])].sort(
    (a, b) => rank(order, a.identifier) - rank(order, b.identifier),
  );
}

const rank = (order: string[], id: string) => {
  const index = order.indexOf(id);
  return index === -1 ? order.length : index;
};

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'not_entitled';

/** Buys one package for the board. Backing out of the store sheet is not an error. */
export async function buySubscription(
  boardId: string,
  pkg: PurchasesPackage,
): Promise<PurchaseOutcome> {
  await ready(boardId);
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

/** Restores this store account's purchases onto the board. */
export async function restoreSubscription(boardId: string): Promise<boolean> {
  await ready(boardId);
  return hasPro(await Purchases.restorePurchases());
}

/** RevenueCat's Customer Center: cancel, change plan, request a refund. */
export async function manageSubscription(boardId: string): Promise<void> {
  await ready(boardId);
  await RevenueCatUI.presentCustomerCenter();
}
