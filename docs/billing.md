# Billing — Band Wall subscription

**Status:** not live anywhere. First built per band ([PR #4](https://github.com/eltonSalanic/artist-dashboard/pull/4)); reworked on 2026-10-30 so a subscription belongs to a person who owns a band. Nothing is hosted yet, the App Store and Play products don't exist yet, and `BILLING_ENFORCED` is off everywhere until the account setup below is done. Locally, the RevenueCat **Test Store** key lets the web and phone checkouts run end to end. [Where it stands](#where-it-stands) lists what's tested and what's left.

A Band Wall subscription **belongs to a person** and entitles them to **own one band**: **$5.99/month or $59.99/year**. Joining a band is free, and anyone can be in as many bands as they like. A band stays open for everyone in it while its owner is subscribed. There is no free tier: with billing enforced, you can't create a band without a subscription, and a band whose owner has lapsed locks for everyone. Both plans start with a **one-month free trial** for new subscribers.

## Decisions

Elton made these on 2026-10-29. Change them here and in `BAND_WALL_PLAN` together.

- **It's yours, and it lets you own one band.** The subscription belongs to the person. Joining is free and unlimited. Everyone in a band is covered by its owner.
- **Every band has one owner**, separate from the admin role. Admins keep running the band; only the owner handles the subscription, hands the band over or deletes it.
- **No free tier.** With `BILLING_ENFORCED=true`, creating a band takes a subscription, and a band only opens while its owner is subscribed.
- **A lapsed band locks; nothing is lost.** Its data stays, members see "This band's owner needs to renew", and it reopens when they do. The same goes if the owner's account goes away.
- **Delete is permanent.** Owner only, typing the band's name to confirm. Then they can start a new band.
- **Hand-over:** the owner can give the band to a member who's subscribed and owns no band.
- **$5.99 a month or $59.99 a year.** The yearly plan is billed as "2 months free" (12 × $5.99 = $71.88).
- **One-month free trial** on both plans, for new subscribers.
- **Names:** customers see "Band Wall subscription" (it was "Band Pro" during development; the code was renamed too). Entitlement `band_wall`; packages `$rc_monthly` / `$rc_annual`; product ids in the table below.
- **Copy is casual**, a musician talking to bands ("First month's on us…").

## Store fees

- **Apple:** enroll in the App Store Small Business Program for **15%** (instead of 30%) on the first $1M a year.
- **Google:** subscriptions are 15% already. **Android stays on Play Billing**: Play's external-offer programs still take a cut and add reporting work, so linking out costs more than it saves at this size.
- **Web:** Stripe through RevenueCat Web Billing, no store fee. Bands that start on the web never pay Apple or Google.
- **Later, maybe:** in the US, iOS apps may now link out to a web checkout. Band Wall could add a "Subscribe on the web" link on iOS to skip Apple's fee. Not built; weigh it once there's real volume.

## How it fits together

```
phone (react-native-purchases) ─┐
                                ├─► RevenueCat ──webhook──► API  POST /billing/revenuecat/webhook
web  (@revenuecat/purchases-js) ┘       │                    │
                                        │                    └─► UserSubscription row (one per person)
App Store / Play / Stripe ◄─────────────┘
```

- **RevenueCat is the source of truth.** The API keeps a copy of each person's entitlement in `UserSubscription`, written only by the webhook (and by the promotional grant script).
- **The RevenueCat app user id is the user's id**, on every platform. The phone calls `Purchases.logIn(userId)` before buying or restoring, the web SDK is configured with `appUserId: userId`, and the Web Purchase Link gets the user id appended. So a purchase made anywhere lands on the same person.
- **`Board.ownerId`** is the owner. New bands set it to their creator. Migration `user_subscriptions` gave every existing band its oldest admin. It's nullable: `SET NULL` when the account goes, and a band with no owner is locked. Nothing in the database stops one person owning two bands; the API does, and an owner who got two from that migration keeps both open.
- **Entitlement:** `band_wall`. **Offering:** the project's current offering (`default`), with RevenueCat's standard packages `$rc_monthly` and `$rc_annual`. These live in `BAND_WALL_PLAN` in [packages/shared/src/billing.ts](../packages/shared/src/billing.ts), along with the display prices and the store product ids:

| Plan | Package | Test Store product | App Store product | Play subscription : base plan (as RevenueCat shows it) |
|---|---|---|---|---|
| Monthly, $5.99 | `$rc_monthly` | `band_wall_monthly` | `bandwall.monthly` | `bandwall_subscription:monthly` |
| Yearly, $59.99 | `$rc_annual` | `band_wall_yearly` | `bandwall.yearly` | `bandwall_subscription:yearly` |

The paywalls read the offering, not these ids, so a mismatch shows up as a package missing from the offering rather than a code error.
- **Free trial:** one month on both plans, set on the store products (App Store introductory offer, Play free-trial offer, Web Billing trial), not in our code. A trial counts as subscribed: RevenueCat sends `INITIAL_PURCHASE` with `period_type` `TRIAL`, the band's row is `ACTIVE` with `isTrial` true, and the trial ends at `currentPeriodEnd`. The first paid `RENEWAL` clears `isTrial`; a trial cancelled before it ends ends in `EXPIRATION` like any other subscription. Settings shows "Free month, ends …".
- **Who gets a trial:** eligibility belongs to the **Apple ID or Google account, per subscription group** (on the web, to the RevenueCat customer, which is the person). One person gets one free month, across every band they ever own. The apps only say "Start free trial" when the store says the buyer is eligible: Play and Web Billing only offer the trial to eligible buyers, and on iOS the app asks RevenueCat (`checkTrialOrIntroductoryPriceEligibility`); an "unknown" answer still shows the trial, and Apple's own purchase sheet states the real terms. Otherwise the buttons show the plain price.
- **Terms and Privacy:** both subscription screens link to `https://bandwall.app/terms` and `https://bandwall.app/privacy` (`BAND_WALL_PLAN.links`), which Apple and Google require. Those pages don't exist yet; publish them before submitting the app. The RevenueCat paywall needs the same two links set in its editor.
- **Who sees what:** the owner gets the plans, the status and Manage subscription. A member sees whose subscription covers the band and whether it's open (`billing.view`); the API doesn't send them the owner's store, dates or trial. "Owner" isn't a role, so it isn't in the `can()` map: `isOwner` on the board summary and on `GET /boards/:id/subscription` says who, and the API checks it for delete and hand-over.
- **The web checkout:** `@revenuecat/purchases-js`, configured with the board's id. When the current offering has a RevenueCat paywall, "Start free trial" (or "Subscribe to Band Wall") presents it. Without one, the web shows one button per plan, priced from the offering, and goes straight to RevenueCat's checkout for that package. The web SDK has no Customer Center, so "Manage subscription" opens RevenueCat's `managementURL`.
- **The phone:** the same RevenueCat paywall, through `RevenueCatUI.presentPaywall`. It opens by itself at `/subscribe`, when someone with no subscription presses Create A Band, and from "Start free trial" (or "Subscribe to Band Wall") on a locked band and at `/board/:boardId/subscribe`. Those screens also carry restore purchases, and RevenueCat's Customer Center handles managing. If the paywall can't load, the screen falls back to a plain list of the offering's plans.

## The enforcement rule

With `BILLING_ENFORCED=true`, **every board route answers `402` with code `BOARD_SUBSCRIPTION_REQUIRED`** unless `BillingService.isPro(boardId)` is true, meaning the band's owner is subscribed. A board route is any route marked `@BoardRoles`, i.e. anything under `/boards/:boardId/…` and `/boards/:id`. The check is `SubscriptionGuard` ([apps/api/src/billing/subscription.guard.ts](../apps/api/src/billing/subscription.guard.ts)), a global guard that runs after the membership check, so a stranger still gets a `404`, not a hint that the band is locked.

`isPro` is true when the row's status is anything but `EXPIRED` **and** the paid period hasn't ended (a null period end is a lifetime promotional grant). The period check is a backstop for a missed `EXPIRATION` webhook.

**Creating a band** (`POST /boards`) has its own rule, from `BillingService.ownershipBlock`: no subscription answers `402 SUBSCRIPTION_REQUIRED`, and already owning a band answers `409 BAND_LIMIT_REACHED`. A trial counts as subscribed. `GET /me/subscription` returns the same answer as `createBlock`, so the apps can show the paywall or the limit before anyone types a name.

**Stays open on a locked band:**

| Route | Why |
|---|---|
| `/api/auth/*`, `/me`, `/me/bootstrap`, `/me/password`, `/me/devices`, `/me/subscription` | Signing in and the user's own profile have no board |
| `GET /boards` (and the `boards` list on `/me`) | Lists every band, locked ones included, each with `isPro`, `isOwner` and `subscriptionRequired`, so the apps can show which are locked |
| `/boards/:boardId/invites` (`@SkipSubscription`) | Joining never costs anything, and admins can line people up while the owner renews |
| Joining with an invite (`/me/bootstrap` email match, the invite-code sign-in) | No board route involved |
| `GET /boards/:boardId/subscription` (`@SkipSubscription`) | What tells the apps which screen to show |
| `POST /billing/revenuecat/webhook`, `/webhooks/resend`, `/unsubscribe`, `/health` | No board |

**Narrowed rather than refused:** the cross-board `GET /calendar` and `/mentions` skip locked bands (`UserBoardsGuard` drops them), the same way their own routes answer 402.

Everything else on a band, including `GET /boards/:id`, settings, removing members, delete, hand-over and notification preferences, is closed until the owner renews. So a lapsed owner renews first, then deletes or hands over.

**The apps:** `/me`'s board list carries `subscriptionRequired` (enforced and the owner isn't subscribed). The web shell shows a screen in place of every page for such a band, and the phone in place of the hub and every `/board/:boardId/…` route: the owner gets the plans, everyone else gets "This band's owner needs to renew". The web's band switcher marks it "Needs renewing" (owner) or "Locked" (member). "Create a band" shows the plans first if you need them (the web in its dialog, the phone at `/subscribe`), or explains the one-band limit.

**Not gated (known gap):** the background notification jobs (day-of show summary, tasks-due digest, reminder pushes) still send for locked bands. Gate them with `BillingService.isPro` when that matters.

### `BILLING_ENFORCED`

| Environment | Value | Why |
|---|---|---|
| Local dev | `false` (default when unset) | Existing local bands keep working, and anyone can create any number of bands |
| Staging | `true` once the Stripe sandbox / Test Store checkout works | Exercise the real flow |
| Production | `true` only after running the promotional grant for existing band owners | Otherwise every existing band locks on deploy |

Only the literal strings `true` and `false` are accepted; anything else fails at boot.

## Webhook

`POST /billing/revenuecat/webhook`, public (RevenueCat can't sign in).

- **Auth:** RevenueCat sends back the Authorization header value set on the webhook in its dashboard. The API compares it in constant time with `REVENUECAT_WEBHOOK_AUTH`. Wrong or missing → `401`; the variable unset → every request refused (`400`). Use a long random value (`openssl rand -hex 32`), and paste the same string into RevenueCat.
- **Idempotency:** each processed event id is stored in `BillingWebhookEvent`, in the same transaction as the change. A repeat is answered `200 { outcome: "duplicate" }` and skipped. If applying fails, nothing is recorded and RevenueCat's retry gets another go.
- **Finding the person:** the first of `app_user_id`, `original_app_user_id` and `aliases` that is an existing user's id. A purchase begun before `logIn` (an anonymous id) is still found once the user id is an alias. An event that names no user is recorded and answered `200` (`unknown_user`), so RevenueCat stops retrying it.
- **Mapping** (only events whose `entitlement_ids` include `band_wall`; events without an entitlement list are taken as ours):

| RevenueCat event | Status | `willRenew` | Notes |
|---|---|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION` | `ACTIVE` | true | Period end from `expiration_at_ms` |
| `PRODUCT_CHANGE` | `ACTIVE` | true | Keeps the current `product_id`; the next `RENEWAL` carries the new one |
| `BILLING_ISSUE` | `GRACE` | true | Access stays on while the store retries |
| `CANCELLATION` | `CANCELLED` | false | Access stays on until the period ends. A refund comes with an expiration in the past, which ends access through `isPro` |
| `EXPIRATION` | `EXPIRED` | false | The only event that revokes access |
| `TRANSFER` | — | — | The receiving person takes over the sender's row; the sender is set `EXPIRED`, which locks any band they own |
| anything else (`TEST`, `NON_RENEWING_PURCHASE`, …) | — | — | Recorded and ignored |

Stores map `APP_STORE`/`MAC_APP_STORE` → `APP_STORE`, `PLAY_STORE` → `PLAY_STORE`, `STRIPE` and `RC_BILLING` (Web Billing) → `STRIPE`, and `PROMOTIONAL` (and anything unknown, such as the Test Store) → `PROMOTIONAL`.

**Not handled yet:** out-of-order delivery. An older event arriving after a newer one overwrites it. RevenueCat rarely does this, but if it shows up, store `event_timestamp_ms` on the row and skip older events.

## Bands and owners

- `DELETE /boards/:id` with `{ name }`: owner only (403 otherwise), and the name has to match (400). It removes the band and every row under it, then its files from Storage; a Storage failure is logged and leaves orphaned files, not a half-deleted band.
- `POST /boards/:id/transfer` with `{ userId }`: owner only. The new owner has to be a member, subscribed and own no band (400 or 409). They become an admin, and the old owner stays on as one.
- **Not built:** deleting an account. The rule is decided (the band locks and keeps its data), and `Board.ownerId` is ready for it, but `Invite.invitedById` still blocks deleting a user who sent an invite. A band whose owner is gone has no way back yet except setting `ownerId` by hand.

## Promotional grants

For the owners of bands that existed before billing, and for comps. Writes `store=PROMOTIONAL`, `status=ACTIVE` to the person, and leaves anyone who already pays through a store alone:

```bash
npm run billing:grant -w apps/api -- <email or userId> [...]
npm run billing:grant -w apps/api -- --all                     # every band owner who isn't subscribed, forever
npm run billing:grant -w apps/api -- --all --until 2027-06-30  # ends on that date
```

It writes the database `DATABASE_URL` points at, and RevenueCat doesn't know about it. To give a comp that RevenueCat tracks, grant a promotional entitlement to the user id in the RevenueCat dashboard instead; it arrives through the webhook as store `PROMOTIONAL`.

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
- `NEXT_PUBLIC_REVENUECAT_WEB_PURCHASE_URL` is a fallback for a build with no web key: the button opens RevenueCat's hosted checkout (the link from the dashboard, with the user id appended as the app user id) in a new tab.
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

1. **Project:** "Band Wall" (`projfba9b48a`), created 2026-10-29. It has a **Test Store** app (key `test_…`, in the local env files) for dev until the stores are connected, the `band_wall` entitlement, the `default` offering, and a **published paywall** styled like the phone app (Figtree from Google Fonts, cream and near-black, no cards, bullet list, "Start free trial"). The paywall's Terms and Privacy links point at `bandwall.app/terms` and `bandwall.app/privacy`.
2. **Apps:** add the **App Store** app (bundle id `com.bandwall.app`, the In-App Purchase key and issuer id, the shared secret), the **Play Store** app (package `com.bandwall.app`, the service account JSON), and a **Web Billing** app connected to Stripe (the sandbox for staging, the live account for production). Each gives its own public SDK key for the table above.
3. **Products:** import the App Store and Play products, and create the two Web Billing products (monthly $5.99, yearly $59.99), each with a **1-month free trial**. The Test Store products `band_wall_monthly` and `band_wall_yearly` carry the same trial for local testing.
4. **Entitlement `band_wall`:** attach all the monthly and yearly products from every store.
5. **Offering:** `default` is the current offering, with RevenueCat's standard packages `$rc_monthly` and `$rc_annual`, each holding that period's product from every store (today, the Test Store's `band_wall_monthly` at $5.99 and `band_wall_yearly` at $59.99, matching the copy in the apps). Design the **paywall** for it (the web uses `presentPaywall`).
6. **Customer Center:** turn it on (the phone's "Manage subscription" opens it).
7. **Restore behavior** (Project settings): choose **keep with original App User ID**, not "transfer", so a restore under a second Band Wall account can't quietly move someone's subscription and lock their band. If it is left on transfer, the webhook handles the `TRANSFER` event, but the sender's band locks.
8. **Webhooks**, one per environment, each with its own Authorization value (= that API's `REVENUECAT_WEBHOOK_AUTH`):
   - staging: `https://<staging API host>/billing/revenuecat/webhook`
   - production: `https://<production API host>/billing/revenuecat/webhook`, sending **both sandbox and production** events. App Review buys with sandbox accounts against the production build, and the reviewer has to get past the paywall.
   - dev (optional): through a tunnel (`npm run mobile:tunnel`) to `http://…/billing/revenuecat/webhook`.
   If one RevenueCat project serves both staging and production, filter the staging webhook to sandbox events. User ids differ per database, so a staging event that reaches production only lands as `unknown_user`.

## Deploying it

Nothing is hosted yet ([release-workflow.md](release-workflow.md)). When the API and web go up, per environment:

1. Deploy the API and run `npx prisma migrate deploy`. That applies `20261029212835_billing` and `20261030051540_user_subscriptions` (the `UserSubscription` and `BillingWebhookEvent` tables, RLS on, and an owner for every band).
2. Set the env vars from the table above. Leave `BILLING_ENFORCED` unset (off).
3. Add that environment's webhook in RevenueCat and check one event lands (the API logs `RevenueCat <TYPE> <id>: applied`).
4. Run `npm run billing:grant -w apps/api -- --all` against that database, so every band that exists today stays open.
5. Then set `BILLING_ENFORCED=true` and redeploy the API. Creating a band now takes a subscription.

## Where it stands

- **Tested:** the feature test of 2026-10-29 ([report](https://claude.ai/artifact/BqLFMPYe2K2uLmb5nka4b8)) covered the per-band version. The move to owners was checked on 2026-10-30 with unit tests and a live run of the API rules, the web screens and the phone screens.
- **Left for Elton:** the Trello card [Band Wall subscriptions: manual testing to do](https://trello.com/c/JYkdHryG) (real iPhone, restore, Customer Center, a real webhook, the trial end to end, Android).
- **Known limitation:** a Test Store purchase arrives as store `TEST_STORE`, which is stored as `PROMOTIONAL`, so settings calls it a promotional grant and hides Manage subscription. Real App Store, Play and web purchases are stored correctly.
- **Follow-ups:**
  - Upgrade `react-native-purchases` to 11.x when its iOS pod ships (the pin above).
  - Publish `bandwall.app/terms` and `bandwall.app/privacy` before store submission.
  - Gate the notification jobs for locked bands (see *Not gated* above).
  - Skip out-of-order webhook events (see *Not handled yet* above).
  - The phone's band switcher doesn't mark locked bands the way the web's does.
  - Deleting an account, and a way back for a band whose owner is gone (see *Bands and owners*).

## Testing locally with the Test Store

1. Put the Test Store key in `apps/web/.env.local` (`NEXT_PUBLIC_REVENUECAT_WEB_KEY`) and `apps/mobile/.env` (both `EXPO_PUBLIC_REVENUECAT_*_KEY`). Restart the dev servers.
2. Set `BILLING_ENFORCED=true` in `apps/api/.env` and restart the API: every band whose owner isn't subscribed locks. With it off (the default), neither app shows a paywall: Create A Band goes straight to naming the band.
3. For the purchase to unlock the band, the webhook has to reach your API: expose it (e.g. ngrok), add a dev webhook in RevenueCat with an Authorization value, and set the same value as `REVENUECAT_WEBHOOK_AUTH`. Without that, the purchase succeeds in RevenueCat but the page waits on "Confirming your purchase…". `npm run billing:grant -w apps/api -- <owner's email>` unlocks a band by hand.
4. Turn `BILLING_ENFORCED` back off afterwards, or grant your local boards.
