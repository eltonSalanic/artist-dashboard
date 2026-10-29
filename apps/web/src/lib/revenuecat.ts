import { BAND_PRO, webPurchaseUrl } from "@artist/shared";
import type { Purchases } from "@revenuecat/purchases-js";
import { env } from "@/lib/env";

/**
 * The RevenueCat Web SDK, set up for one band at a time. Band Pro belongs to
 * the board, so the board's id is the RevenueCat app user id here, on the
 * phone (`Purchases.logIn(boardId)`) and in the Web Purchase Link alike.
 *
 * Loaded on demand: the SDK touches `window`, and most visits never open a
 * paywall.
 */
async function purchasesFor(boardId: string): Promise<Purchases | null> {
  if (!env.revenueCatWebKey) return null;
  const { Purchases } = await import("@revenuecat/purchases-js");
  if (!Purchases.isConfigured()) {
    return Purchases.configure({
      apiKey: env.revenueCatWebKey,
      appUserId: boardId,
    });
  }
  const purchases = Purchases.getSharedInstance();
  // The SDK is a singleton; switching band switches its customer.
  if (purchases.getAppUserId() !== boardId) await purchases.changeUser(boardId);
  return purchases;
}

/** Whether this build can sell Band Pro on the web at all. */
export const webCheckoutAvailable = () =>
  !!env.revenueCatWebKey || !!env.revenueCatWebPurchaseUrl;

export type PaywallOutcome = "purchased" | "cancelled" | "redirected";

/**
 * Shows RevenueCat's paywall for the current offering as a full-screen
 * overlay. Without a web key it falls back to the Web Purchase Link, which
 * opens RevenueCat's hosted checkout in a new tab.
 *
 * Resolves "cancelled" when the person backs out; any other failure throws.
 */
export async function presentBandProPaywall(
  boardId: string,
  customerEmail?: string,
): Promise<PaywallOutcome> {
  const purchases = await purchasesFor(boardId);
  if (!purchases) {
    const url = webPurchaseUrl(env.revenueCatWebPurchaseUrl, boardId);
    if (!url) throw new Error("Band Pro isn't available on the web yet.");
    window.open(url, "_blank", "noopener");
    return "redirected";
  }

  const { ErrorCode, PurchasesError } = await import(
    "@revenuecat/purchases-js"
  );
  try {
    const result = await purchases.presentPaywall({
      customerEmail,
      // From the paywall's "manage" link: same place as the settings button.
      onVisitCustomerCenter: () => void openManageSubscription(boardId),
      onBack: (close) => close(),
    });
    return result.customerInfo.entitlements.active[BAND_PRO.entitlement]
      ? "purchased"
      : "cancelled";
  } catch (error) {
    if (
      error instanceof PurchasesError &&
      error.errorCode === ErrorCode.UserCancelledError
    ) {
      return "cancelled";
    }
    throw error;
  }
}

/**
 * Where the band's subscription is managed: RevenueCat's page for a web
 * purchase, or the App Store / Play Store page for one bought on a phone.
 * The web SDK has no Customer Center of its own; `managementURL` is its
 * stand-in. Null when there is nothing to manage from here.
 */
export async function manageSubscriptionUrl(
  boardId: string,
): Promise<string | null> {
  const purchases = await purchasesFor(boardId);
  if (!purchases) return null;
  const info = await purchases.getCustomerInfo();
  return info.managementURL;
}

async function openManageSubscription(boardId: string) {
  const url = await manageSubscriptionUrl(boardId);
  if (url) window.open(url, "_blank", "noopener");
}
