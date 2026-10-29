import { parseAppEnv } from "@artist/shared";

/**
 * Next inlines `NEXT_PUBLIC_*` at build time, so each is read by its literal
 * name.
 *
 * A production build without an API URL used to fall back to localhost:3001
 * silently, which ships a site that can't load anything. Now the build fails
 * and says why; only `next dev` keeps the localhost default.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl && process.env.NODE_ENV === "production") {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. Set it in the host's environment variables (or apps/web/.env.local) before building.",
  );
}

export const env = {
  apiUrl: (apiUrl ?? "http://localhost:3001").replace(/\/+$/, ""),
  /** development | staging | production — tags logs and error reports. */
  appEnv: parseAppEnv(process.env.NEXT_PUBLIC_APP_ENV),
  /**
   * RevenueCat Web Billing public key (docs/billing.md). Unset hides the
   * in-page subscription checkout; `test_` keys use RevenueCat's Test Store.
   */
  revenueCatWebKey: process.env.NEXT_PUBLIC_REVENUECAT_WEB_KEY || null,
  /** Optional RevenueCat Web Purchase Link, used when there is no web key. */
  revenueCatWebPurchaseUrl:
    process.env.NEXT_PUBLIC_REVENUECAT_WEB_PURCHASE_URL || null,
} as const;
