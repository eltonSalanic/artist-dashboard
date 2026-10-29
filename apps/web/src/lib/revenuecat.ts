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
export type BandProPlan = "monthly" | "yearly";

/** What the web checkout can offer right now, read from the current offering. */
export interface WebOffering {
  /** A RevenueCat paywall is designed for the offering; show it. */
  hasPaywall: boolean;
  /** Store prices, formatted. Null when the offering lacks that package. */
  prices: Record<BandProPlan, string | null>;
}

/**
 * The current offering, for deciding what the Subscribe control looks like.
 * Null when there is no web key (the Web Purchase Link fallback, if any, has
 * no offering to read).
 */
export async function webOffering(boardId: string): Promise<WebOffering | null> {
  const purchases = await purchasesFor(boardId);
  if (!purchases) return null;
  const offering = (await purchases.getOfferings()).current;
  return {
    hasPaywall: offering?.hasPaywall ?? false,
    prices: {
      monthly: offering?.monthly?.webBillingProduct.price.formattedPrice ?? null,
      yearly: offering?.annual?.webBillingProduct.price.formattedPrice ?? null,
    },
  };
}

/**
 * Starts checkout. With a RevenueCat paywall designed for the current
 * offering, shows it as a full-screen overlay and the person picks a plan
 * there. Without one, goes straight to RevenueCat's checkout for `plan`.
 * Without a web key at all, opens the Web Purchase Link in a new tab.
 *
 * Resolves "cancelled" when the person backs out; any other failure throws.
 */
export async function startBandProCheckout(
  boardId: string,
  plan: BandProPlan,
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
    const offering = (await purchases.getOfferings()).current;
    if (!offering) throw new Error("No Band Pro offering is set up.");
    let customerInfo;
    if (offering.hasPaywall) {
      ({ customerInfo } = await purchases.presentPaywall({
        offering,
        customerEmail,
        // From the paywall's "manage" link: same place as the settings button.
        onVisitCustomerCenter: () => void openManageSubscription(boardId),
        onBack: (close) => close(),
      }));
    } else {
      const rcPackage = plan === "yearly" ? offering.annual : offering.monthly;
      if (!rcPackage) throw new Error(`The offering has no ${plan} package.`);
      ({ customerInfo } = await purchases.purchase({ rcPackage, customerEmail }));
    }
    return customerInfo.entitlements.active[BAND_PRO.entitlement]
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
