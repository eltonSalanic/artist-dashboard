# Billing — Band Wall subscription

**Status:** built on `feat/billing`; not live anywhere. No store products exist yet, and `BILLING_ENFORCED` is off everywhere until the account setup below is done. Locally, the RevenueCat **Test Store** key lets the web and phone checkouts run end to end.

Band Wall is a subscription **per band (board)**, not per person: **$5.99/month or $59.99/year**. Whoever pays, the whole band gets it, and members of a paid band never pay themselves. There is no free tier: with billing enforced, a band without a subscription can't open its wall. Both plans start with a **one-month free trial** for new subscribers.

## How it fits together

```
phone (react-native-purchases) ─┐
                                ├─► RevenueCat ──webhook──► API  POST /billing/revenuecat/webhook
web  (@revenuecat/purchases-js) ┘       │                    │
                                        │                    └─► BoardSubscription row (one per board)
App Store / Play / Stripe ◄─────────────┘
```

- **RevenueCat is the source of truth.** The API keeps a copy of each board's entitlement in `BoardSubscription`, written only by the webhook (and by the promotional grant script).
- **The RevenueCat app user id is the board's id**, on every platform. The phone calls `Purchases.logIn(boardId)` before buying or restoring, the web SDK is configured with `appUserId: boardId`, and the Web Purchase Link gets the board id appended. So a purchase made anywhere lands on the same customer and the same board.
- **Entitlement:** `band_wall`. **Offering:** the project's current offering (`default`), with RevenueCat's standard packages `$rc_monthly` and `$rc_annual`. These live in `BAND_WALL_PLAN` in [packages/shared/src/billing.ts](../packages/shared/src/billing.ts), along with the display prices and the store product ids:

| Plan | Package | Test Store product | App Store product | Play subscription : base plan (as RevenueCat shows it) |
|---|---|---|---|---|
| Monthly, $5.99 | `$rc_monthly` | `band_wall_monthly` | `bandwall.monthly` | `bandwall_subscription:monthly` |
| Yearly, $59.99 | `$rc_annual` | `band_wall_yearly` | `bandwall.yearly` | `bandwall_subscription:yearly` |

The paywalls read the offering, not these ids, so a mismatch shows up as a package missing from the offering rather than a code error.
- **Free trial:** one month on both plans, set on the store products (App Store introductory offer, Play free-trial offer, Web Billing trial), not in our code. A trial counts as subscribed: RevenueCat sends `INITIAL_PURCHASE` with `period_type` `TRIAL`, the band's row is `ACTIVE` with `isTrial` true, and the trial ends at `currentPeriodEnd`. The first paid `RENEWAL` clears `isTrial`; a trial cancelled before it ends ends in `EXPIRATION` like any other subscription. Settings shows "Free month, ends …".
- **Who gets a trial:** eligibility belongs to the **Apple ID or Google account, per subscription group**, not to the band (on the web, to the RevenueCat customer, which is the band). So an admin who already had a free month on one band won't get another one buying for a second band from the same Apple ID or Google account. The apps only say "Start your free month" when the store says the buyer is eligible: Play and Web Billing only offer the trial to eligible buyers, and on iOS the app asks RevenueCat (`checkTrialOrIntroductoryPriceEligibility`); an "unknown" answer still shows the trial, and Apple's own purchase sheet states the real terms. Otherwise the buttons show the plain price.
- **Who can buy:** admins (`billing.manage` in the shared `can()` map). Every member can see the status (`billing.view`). Members are told to ask an admin.

## The enforcement rule

With `BILLING_ENFORCED=true`, **every board route answers `402` with code `BOARD_SUBSCRIPTION_REQUIRED`** until `BillingService.isPro(boardId)` is true. A board route is any route marked `@BoardRoles`, i.e. anything under `/boards/:boardId/…` and `/boards/:id`. The check is `SubscriptionGuard` ([apps/api/src/billing/subscription.guard.ts](../apps/api/src/billing/subscription.guard.ts)), a global guard that runs after the membership check, so a stranger still gets a `404`, not a hint that the board is unpaid.

`isPro` is true when the row's status is anything but `EXPIRED` **and** the paid period hasn't ended (a null period end is a lifetime promotional grant). The period check is a backstop for a missed `EXPIRATION` webhook.

**Stays open on an unpaid board:**

| Route | Why |
|---|---|
| `/api/auth/*`, `/me`, `/me/bootstrap`, `/me/password`, `/me/devices` | Signing in and the user's own profile have no board |
| `GET /boards` (and the `boards` list on `/me`) | Lists every band, unpaid ones included, each with `isPro` and `subscriptionRequired`, so the apps can show which need paying |
| `POST /boards` | Starting a band |
| `/boards/:boardId/invites` (`@SkipSubscription`) | A band can gather its members before anyone pays |
| Joining with an invite (`/me/bootstrap` email match, the invite-code sign-in) | No board route involved |
| `GET /boards/:boardId/subscription` (`@SkipSubscription`) | What tells the apps to show the paywall |
| `POST /billing/revenuecat/webhook`, `/webhooks/resend`, `/unsubscribe`, `/health` | No board |

**Narrowed rather than refused:** the cross-board `GET /calendar` and `/mentions` skip unpaid boards (`UserBoardsGuard` drops them), the same way their own routes answer 402.

Everything else on a board, including `GET /boards/:id`, settings, removing members and notification preferences, is closed until the band pays.

**The apps:** `/me`'s board list carries `subscriptionRequired` (enforced and not Pro). The web shell shows the subscription paywall in place of every page for such a board, and the band switcher marks it "Needs a subscription". The phone shows the subscription screen in place of the board hub and every `/board/:boardId/…` route.

**Not gated (known gap):** the background notification jobs (day-of show summary, tasks-due digest, reminder pushes) still send for unpaid boards. Gate them with `BillingService.isPro` when that matters.

### `BILLING_ENFORCED`

| Environment | Value | Why |
|---|---|---|
| Local dev | `false` (default when unset) | Existing local boards keep working with no subscription |
| Staging | `true` once the Stripe sandbox / Test Store checkout works | Exercise the real flow |
| Production | `true` only after running the promotional grant for existing bands | Otherwise every existing band hits the paywall on deploy |

Only the literal strings `true` and `false` are accepted; anything else fails at boot.

## Webhook

`POST /billing/revenuecat/webhook`, public (RevenueCat can't sign in).

- **Auth:** RevenueCat sends back the Authorization header value set on the webhook in its dashboard. The API compares it in constant time with `REVENUECAT_WEBHOOK_AUTH`. Wrong or missing → `401`; the variable unset → every request refused (`400`). Use a long random value (`openssl rand -hex 32`), and paste the same string into RevenueCat.
- **Idempotency:** each processed event id is stored in `BillingWebhookEvent`, in the same transaction as the change. A repeat is answered `200 { outcome: "duplicate" }` and skipped. If applying fails, nothing is recorded and RevenueCat's retry gets another go.
- **Finding the board:** the first of `app_user_id`, `original_app_user_id` and `aliases` that is an existing board's id. A purchase begun before `logIn` (an anonymous id) is still found once the board id is an alias. An event that names no board is recorded and answered `200` (`unknown_board`), so RevenueCat stops retrying it.
- **Mapping** (only events whose `entitlement_ids` include `band_wall`; events without an entitlement list are taken as ours):

| RevenueCat event | Status | `willRenew` | Notes |
|---|---|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION` | `ACTIVE` | true | Period end from `expiration_at_ms` |
| `PRODUCT_CHANGE` | `ACTIVE` | true | Keeps the current `product_id`; the next `RENEWAL` carries the new one |
| `BILLING_ISSUE` | `GRACE` | true | Access stays on while the store retries |
| `CANCELLATION` | `CANCELLED` | false | Access stays on until the period ends. A refund comes with an expiration in the past, which ends access through `isPro` |
| `EXPIRATION` | `EXPIRED` | false | The only event that revokes access |
| `TRANSFER` | — | — | The receiving board takes over the sending board's row; the sender is set `EXPIRED` |
| anything else (`TEST`, `NON_RENEWING_PURCHASE`, …) | — | — | Recorded and ignored |

Stores map `APP_STORE`/`MAC_APP_STORE` → `APP_STORE`, `PLAY_STORE` → `PLAY_STORE`, `STRIPE` and `RC_BILLING` (Web Billing) → `STRIPE`, and `PROMOTIONAL` (and anything unknown, such as the Test Store) → `PROMOTIONAL`.

**Not handled yet:** out-of-order delivery. An older event arriving after a newer one overwrites it. RevenueCat rarely does this, but if it shows up, store `event_timestamp_ms` on the row and skip older events.

## Promotional grants

For bands that existed before billing, and for comps. Writes `store=PROMOTIONAL`, `status=ACTIVE`, and leaves any board that already pays through a store alone:

```bash
npm run billing:grant -w apps/api -- <boardId> [<boardId>...]
npm run billing:grant -w apps/api -- --all                     # every board without Pro, forever
npm run billing:grant -w apps/api -- --all --until 2027-06-30  # ends on that date
```

It writes the database `DATABASE_URL` points at, and RevenueCat doesn't know about it. To give a comp that RevenueCat tracks, grant a promotional entitlement to the board id in the RevenueCat dashboard instead; it arrives through the webhook as store `PROMOTIONAL`.

**Before turning on `BILLING_ENFORCED` in production, run `--all` against production.**

## Environment variables

| Variable | App | Dev | Staging | Production |
|---|---|---|---|---|
| `BILLING_ENFORCED` | API | `false` | `true` when ready | `true` after the grant |
| `REVENUECAT_WEBHOOK_AUTH` | API | optional (only to test the webhook through a tunnel) | its own random value | its own random value |
| `NEXT_PUBLIC_REVENUECAT_WEB_KEY` | web | Test Store key (`test_…`) | Web Billing **sandbox** key (Stripe test mode) | Web Billing **production** key (live Stripe) |
| `NEXT_PUBLIC_REVENUECAT_WEB_PURCHASE_URL` | web | optional | optional | optional |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | mobile | Test Store key | Apple key (`appl_…`) | Apple key (`appl_…`) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | mobile | Test Store key | Google key (`goog_…`) | Google key (`goog_…`) |

- Every key above except `REVENUECAT_WEBHOOK_AUTH` is a **public** SDK key: it ships in the web bundle or the app. Still, keep them in env files that git ignores (`apps/web/.env.local`, `apps/mobile/.env`) or the host's / EAS's environment, not in the repo.
- Missing web or mobile keys hide the buying controls. With billing enforced and no key, the paywall says to subscribe from the other platform.
- `NEXT_PUBLIC_REVENUECAT_WEB_PURCHASE_URL` is a fallback for a build with no web key: the button opens RevenueCat's hosted checkout (the link from the dashboard, with the board id appended as the app user id) in a new tab.
- On EAS, set the mobile keys per build profile in `eas.json` or as EAS environment variables. Changing them needs a new build or update, since `EXPO_PUBLIC_*` values are inlined.
- **Pinned, temporarily:** `react-native-purchases` and `react-native-purchases-ui` are pinned to exactly **10.16.0**, an exception to the latest-versions rule that Elton approved on 2026-10-29. 11.0.0 needs the iOS pod `PurchasesHybridCommon` 20.1.0, which wasn't on CocoaPods yet, so `pod install` failed. **TODO:** once `pod trunk info PurchasesHybridCommon` lists 20.1.0 (or later), upgrade both with `npx expo install react-native-purchases@latest react-native-purchases-ui@latest`, rebuild, and remove this note.
- `react-native-purchases` is a native module: phones need a **new development build** made after this branch, and it doesn't run in Expo Go except in RevenueCat's preview mode.

## Account setup (Elton)

Do these in order; each later step needs the earlier ones.

### 1. App Store Connect

1. **Agreements, Tax, and Banking:** sign the **Paid Apps** agreement and fill in banking and tax. Subscriptions can't be sold or tested in sandbox until it's active.
2. **App Store Small Business Program:** enroll (15% commission instead of 30% under $1M a year).
3. In the Band Wall app (`com.bandwall.app`): **Subscriptions** → create a **subscription group** (e.g. "Band Wall") with two auto-renewable subscriptions: `bandwall.monthly` at $5.99 a month and `bandwall.yearly` at $59.99 a year. On each, add an **introductory offer: free trial, 1 month, new subscribers**. Add the localized names and the review screenshot each one asks for.
4. **Users and Access → Integrations → In-App Purchase:** create an **In-App Purchase key** (`.p8`) for RevenueCat, and note the issuer id. Also note the app-specific shared secret.
5. Create a **sandbox tester** under Users and Access for testing on a phone.

### 2. Google Play Console

1. **Payments profile:** set up a merchant account (Settings → Payments profile).
2. Upload a build with the billing permission (any build made after this branch) to an internal testing track; Play won't let you create subscriptions before that.
3. **Monetize → Subscriptions:** create one subscription, `bandwall_subscription`, with two auto-renewing base plans: `monthly` at $5.99 and `yearly` at $59.99. On each base plan, add an **offer: free trial, 1 month, eligibility "New customer acquisition"** (never had this subscription). RevenueCat imports them as `bandwall_subscription:monthly` and `bandwall_subscription:yearly`.
4. Subscriptions already pay Google's **15% service fee**; nothing to enroll in.
5. Create a **Google Cloud service account** with access to the Play Developer API, invite it in Play Console with financial and order permissions, and download its JSON key for RevenueCat. Add **license testers** for test purchases.

### 3. Stripe

1. Create (or reuse) Elton's **Stripe account** and finish activation (business details, bank account) for live payments.
2. Create **sandboxes** for dev and staging (Stripe's test environments). Production uses the live account.

### 4. RevenueCat

1. **Project:** created. Keep dev on the **Test Store** app (key `test_…`) until the stores are connected.
2. **Apps:** add the **App Store** app (bundle id `com.bandwall.app`, the In-App Purchase key and issuer id, the shared secret), the **Play Store** app (package `com.bandwall.app`, the service account JSON), and a **Web Billing** app connected to Stripe (the sandbox for staging, the live account for production). Each gives its own public SDK key for the table above.
3. **Products:** import the App Store and Play products, and create the two Web Billing products (monthly $5.99, yearly $59.99), each with a **1-month free trial**. The Test Store products `band_wall_monthly` and `band_wall_yearly` carry the same trial for local testing.
4. **Entitlement `band_wall`:** attach all the monthly and yearly products from every store.
5. **Offering:** `default` is the current offering, with RevenueCat's standard packages `$rc_monthly` and `$rc_annual`, each holding that period's product from every store (today, the Test Store's `band_wall_monthly` at $5.99 and `band_wall_yearly` at $59.99, matching the copy in the apps). Design the **paywall** for it (the web uses `presentPaywall`).
6. **Customer Center:** turn it on (the phone's "Manage subscription" opens it).
7. **Restore behavior** (Project settings): choose **keep with original App User ID**, not "transfer". With the board as the app user id, "transfer" lets an admin restoring on another band move the subscription off the first band. If it is left on transfer, the webhook handles the resulting `TRANSFER` event, but the first band loses Pro.
8. **Webhooks**, one per environment, each with its own Authorization value (= that API's `REVENUECAT_WEBHOOK_AUTH`):
   - staging: `https://<staging API host>/billing/revenuecat/webhook`
   - production: `https://<production API host>/billing/revenuecat/webhook`, sending **both sandbox and production** events. App Review buys with sandbox accounts against the production build, and the reviewer has to get past the paywall.
   - dev (optional): through a tunnel (`npm run mobile:tunnel`) to `http://…/billing/revenuecat/webhook`.
   If one RevenueCat project serves both staging and production, filter the staging webhook to sandbox events. Board ids differ per database, so a staging event that reaches production only lands as `unknown_board`.

## Testing locally with the Test Store

1. Put the Test Store key in `apps/web/.env.local` (`NEXT_PUBLIC_REVENUECAT_WEB_KEY`) and `apps/mobile/.env` (both `EXPO_PUBLIC_REVENUECAT_*_KEY`). Restart the dev servers.
2. Set `BILLING_ENFORCED=true` in `apps/api/.env` and restart the API: every band you're in shows the paywall.
3. For the purchase to unlock the band, the webhook has to reach your API: expose it (e.g. ngrok), add a dev webhook in RevenueCat with an Authorization value, and set the same value as `REVENUECAT_WEBHOOK_AUTH`. Without that, the purchase succeeds in RevenueCat but the page waits on "Confirming your purchase…". `npm run billing:grant -w apps/api -- <boardId>` unlocks a band by hand.
4. Turn `BILLING_ENFORCED` back off afterwards, or grant your local boards.
