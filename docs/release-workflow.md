# Release workflow: dev, staging and beta

> **Status:** staging API live at `https://staging-api.bandwall.app` and the
> `preview` build installs on a registered iPhone and in the Simulator
> (2026-11-16). Prod hosting, the staging web app, EAS Update, store
> submission and the beta groups are not set up yet. See
> [What exists and what's left](#what-exists-and-whats-left).

How a change gets from this Mac to the bands using Band Wall, once friends are
beta testing. Covers the phone app (EAS Build, EAS Update, TestFlight, Google
Play), the API and web deploys they depend on, and database migrations. The
store-builds phase is [P14 in docs/mobile-app.md](mobile-app.md#p14--store-builds).

## Three environments, one beta

**Staging is an environment; beta is a group of people.** Don't mix them up.

| | Dev | Staging | Prod |
|---|---|---|---|
| What it is | Your Mac: local API, Supabase, Metro | Deployed API + web + database, a copy of prod | The real API + web + database, with backups |
| Who uses it | You | You and test accounts only | Beta testers now, everyone later |
| Phone app | Dev client (`development` profile) | `preview` build | `production` build |
| Data | Seed / demo data | Throwaway test data | Real bands — never reset |

**Beta builds point at prod.** Your friends' bands are real, so their data
lives in the environment you keep and back up. Staging stays yours, for
checking a release before it reaches them. Going public on the stores later
means promoting the same prod build, not switching environments.

## Phone builds (EAS Build profiles)

[`apps/mobile/eas.json`](../apps/mobile/eas.json) has three profiles. Each is a
separate install with its own purpose:

| Profile | Built with | Talks to | How it gets to a phone |
|---|---|---|---|
| `development` | `npm run mobile:ios` (on this Mac) | Metro + local API on your Mac | Installed over USB; `mobile:tunnel:cf` when on a hotspot |
| `preview` | `eas build --profile preview` | Staging API | Ad hoc: registered phones only, installed from the build page or `devicectl` (TestFlight internal later) |
| `preview-simulator` | `eas build --profile preview-simulator` | Staging API | The same app built for the iOS Simulator |
| `production` | `eas build --profile production` then `eas submit` | Prod API | TestFlight **external** group + Google Play closed test |

**Test staging with the `preview` build, not the dev client.** The dev client
loads JS from Metro, so it can't tell you whether the real, bundled app works.
The point of staging is to run the same kind of build your testers get.

### The `preview` build today

- **Ad hoc.** `preview` uses `distribution: internal`, so it only installs on
  iPhones registered with `eas device:create` (open the link it gives on the
  phone). The registered list is baked into each build, so a phone added later
  needs a new build. The signing credentials (distribution certificate, shared
  with the team's other apps, and the ad hoc profile) are on EAS now, so
  `--non-interactive` builds work.
- **Same app as prod.** It shares `com.bandwall.app` and the name "Band Wall".
  It installs beside the dev client ("Band Wall (Dev)", `com.bandwall.app.dev`)
  but would replace a TestFlight or App Store copy.
- **Simulator.** An ad hoc build can't run in the Simulator, so
  `preview-simulator` (`extends: preview`, `ios.simulator: true`) builds the
  same app for it.
- **Installing.**
  - Phone: open the build's expo.dev page on the iPhone, or download the
    `.ipa` and run `xcrun devicectl device install app --device <id> <file>.ipa`
    (`xcrun devicectl list devices` gives the id; Wi-Fi works once the phone is
    paired, no cable needed).
  - Simulator: `eas build:run --platform ios --profile preview-simulator --latest`,
    or untar the build and `xcrun simctl install booted <BandWall.app>`.
    `eas build:run` needs macOS to let the terminal control System Events
    (Privacy & Security → Automation).
- **Checking a build end to end.** The You tab has **Send test error** in dev
  and preview builds (not production). Its event should reach Sentry tagged
  with the build's environment and a readable stack trace.

## Distributing to testers

### iOS: TestFlight

One App Store Connect app holds every build uploaded under its bundle ID.
Who sees a build is decided by group:

- **Internal testers** — people on your App Store Connect team (up to 100).
  They can see every build as soon as it's processed. Put yourself here and use
  it for `preview` (staging) builds.
- **External testers** — anyone, by email or a public link (up to 10,000).
  They see only the builds you add to their group, and the first build of each
  version goes through a short Apple beta review. Your friends go here, and you
  only ever add `production` builds to their group.

Testers install Apple's free TestFlight app and tap the invite. TestFlight
builds expire after 90 days, so ship at least that often during the beta.

**Catch:** while staging and prod share `com.bandwall.app` they are the same
app, so a phone holds only one of them at a time. Installing the staging build
replaces the prod one. See
[Suggested: a separate staging app ID](#suggested-a-separate-staging-app-id).

### Android: Google Play closed test

Upload the `production` build to a **closed testing** track and add testers by
email list or share the opt-in link. They install from the Play Store like any
app. Use the **internal testing** track for your own staging checks.

Google requires a new personal developer account to run a closed test with
**at least 12 testers for 14 continuous days** before it can publish publicly.
Starting the Android beta early runs that clock down.

The first Android upload has to be done by hand in the Play Console; after
that `eas submit -p android` works with a Google service account key.

### Web

Nothing to install: share the prod URL.

## Shipping a change

1. **Dev.** Build and test on your Mac as now: a feature branch, the dev
   client, `/feature-test`, the feature's Testing card in Trello.
2. **Merge to `main`.**
3. **Staging.**
   - Deploy the API and web to staging. Run `npx prisma migrate deploy`
     against the **staging** database (the API host's pre-deploy command can
     do it).
   - Ship the phone app to staging the same way it'll go to prod (step 5): an
     EAS Update to the `staging` channel, or a new `preview` build if native
     code changed.
   - Check it yourself on the `preview` build and the staging web app.
4. **Prod.** Deploy the API and web to prod and run `prisma migrate deploy`
   against the prod database. Deploy the API **before** the app update, so
   the app never calls an endpoint that isn't there yet.
   - **The first time billing goes out**, follow [billing.md → Deploying it](billing.md#deploying-it):
     grant existing band owners with `billing:grant --all` before setting
     `BILLING_ENFORCED=true`, or every band locks.
   - **The first time file storage moves to R2**, follow [storage.md → Setting up R2](storage.md#setting-up-r2)
     on staging first, then prod:
     - Each bucket needs a **CORS policy** listing that environment's web
       origin exactly (staging's web URL, `https://bandwall.app` for prod), or
       uploads from the web app fail. The phone doesn't use CORS, so a phone
       test won't catch it: always test a web upload.
     - Ship the app update that sends the signed upload headers (`eas update`
       is enough) **before** setting `STORAGE_PROVIDER=r2`. Older builds don't
       send `Cache-Control`, so their uploads to R2 would be refused.
     - Copy existing files across before switching ([plans/storage-r2.md](plans/storage-r2.md), STO-004).
5. **Phone app to the beta.** Pick by what changed:

   | What changed | How it ships | Review / wait |
   |---|---|---|
   | JS/TS only (screens, logic, copy, styles) | `eas update --channel production` | None — testers get it on next launch or two |
   | Native: a new Expo module or config plugin, `app.json` change, Expo SDK upgrade, permissions, icon/splash | New `production` build + `eas submit` to TestFlight and Play | Apple beta review for a new version; Play review for the closed test |

   An update only reaches builds with the same **runtime version**, so a JS
   change that needs native code it doesn't have can't crash an old build — it
   just won't be delivered to it. When unsure, make a build.
6. **Feedback.** Testers report through TestFlight's screenshot feedback, the
   app's **Report a problem** (You tab, goes to Sentry), or the group chat.
   Turn each into a Trello card.

### Migrations are the risky part

Once real bands are on prod, a bad migration loses their data, and an EAS
Update can be rolled back but a dropped column can't.

- **Every migration runs on staging first,** against data shaped like prod's.
- `prisma migrate deploy` only applies pending migrations; it never resets.
  `prisma migrate dev` and `db reset` are for your Mac only.
- Prefer **additive** changes (add a column, backfill, switch the code over,
  drop the old column in a later release). Old builds stay installed on
  testers' phones for a while and still call the API the old way.
- Take a backup (or check point-in-time restore is on) before a migration that
  rewrites or deletes data.

## What exists and what's left

Checked against the repo and the hosted services on 2026-11-16.

**Already in place**

- `eas.json` has `development`, `preview` and `production` profiles, each
  setting `EXPO_PUBLIC_APP_ENV` (`development` / `staging` / `production`) so
  logs and Sentry events say where they came from
  ([error-handling.md](error-handling.md#environments)).
- `production` auto-increments the build number, with the version source on
  EAS (`appVersionSource: remote`).
- The EAS project (`@eltons/artist-dashboard`), bundle ID and Android package
  `com.bandwall.app`, Apple team `242S9Y93M9`.
- `APP_ENV` on the API and `NEXT_PUBLIC_APP_ENV` on web already distinguish
  staging from prod, and staging runs with `NODE_ENV=production` so mail and
  push are real.
- **The staging API is live** at `https://staging-api.bandwall.app` (a CNAME to
  Railway). Railway project "charismatic-integrity" has one service, the API.
  Its Railway environment is named "production" but it is staging:
  `APP_ENV=staging`, `NODE_ENV=production`. `API_URL` must match the custom
  domain, because Better Auth builds its links from it.
  - Build: `npm ci --include=dev && cd apps/api && npx prisma generate && npm run build`
  - Pre-deploy: `cd apps/api && npx prisma migrate deploy`
  - Start: `cd apps/api && npm run start:prod` (`node --enable-source-maps`)
  - Deploys are started by hand ("Deploy latest commit" in the Railway
    dashboard). Auto-deploy from GitHub is off.
- **Domains.** Planned: `api.bandwall.app` and `bandwall.app` for prod,
  `staging-api.bandwall.app` and `staging.bandwall.app` for staging. Each
  environment gets its own database and its own `BETTER_AUTH_SECRET`, so a
  staging session can never pass on prod.
- **EAS environment variables.** Variables live in EAS environments named after
  the profiles (`development`, `preview`, `production`). `preview` has
  `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SENTRY_DSN`; `SENTRY_AUTH_TOKEN` is a secret in all three. Add
  or change one with `eas env:set` (`env:create` is deprecated in eas-cli 27).
  `EXPO_PUBLIC_*` values are inlined, so a change needs a new build.
- **Sentry source maps.**
  - Phone: uploaded during EAS builds by the `@sentry/react-native` plugin
    (checked: a preview build's test error had a readable trace).
  - API: nothing to upload. The source maps point at absolute `src/` paths
    and Sentry reads the code from the container.
  - Web: the build uploads maps with `apps/web/scripts/sentry-sourcemaps.mjs`
    when `SENTRY_AUTH_TOKEN` is set, then deletes them so they're never served.

**Still to set up**

- **Prod hosting and the staging web app.** Staging has its API and
  database. There is no prod API, no prod database and no web deploy yet (no
  Vercel project). Until the staging web app is up, the staging API's
  `WEB_URL` isn't `https://staging.bandwall.app`, so browser requests from it
  get "Invalid origin".
- **RevenueCat and Google keys for `preview`.** Neither is set in the EAS
  `preview` environment, so buying and Google sign-in are hidden in the
  `preview` build. `BILLING_ENFORCED` is off on staging, so creating a band
  skips the paywall. Turning billing on follows
  [billing.md → Deploying it](billing.md#deploying-it).
- **Lock the database's Data API.** Nothing reads Supabase's Data API (the
  API talks to Postgres directly), so for each hosted project: in
  Settings → Data API, remove `public` from the exposed schemas (or turn the
  Data API off), then run the Security Advisor and expect no "RLS disabled"
  warnings. Migration `20261102200000_lock_down_data_api` already turns RLS on
  for every table and revokes the `anon`/`authenticated` roles, so this is
  the second lock, not the only one.
- **Check the web CSP on staging.** `apps/web/security-headers.ts` sets it.
  Locally only RevenueCat's Test Store runs; with a real Web Billing key the
  checkout embeds Stripe, so buy a sandbox plan on staging with the browser
  console open and add any host a "violates the following Content Security
  Policy directive" error names.
- **API URLs for the `production` build.** `production` has no
  `EXPO_PUBLIC_API_URL` or `EXPO_PUBLIC_SUPABASE_URL` yet (there's no prod API
  to point at), and without them `lib/env.ts` throws at launch. Set them in
  the EAS `production` environment once prod is up.
- **EAS Update.** `expo-updates` isn't installed. `npx expo install
  expo-updates` then `eas update:configure` adds the updates URL and a
  `runtimeVersion` policy; then give each profile a `channel` (`development`,
  `staging`, `production`).
- **`preview` can't go to TestFlight as it is.** It is ad hoc (see
  [The `preview` build today](#the-preview-build-today)). For TestFlight it needs store distribution, and while it
  shares the prod bundle ID it also needs `autoIncrement`, or its build
  numbers will collide with prod's.
- **Store submission.** `submit.production` is empty. iOS needs the App Store
  Connect app record (`ascAppId`); Android needs the Play Console app, the
  first manual upload and a service account key.
- **Push in store builds** needs the APNs key in EAS credentials
  (`eas credentials -p ios`), as noted in P13.
- **Beta groups.** An external TestFlight group for your friends, the Play
  closed test track and its tester list.

## Suggested: a separate staging app ID

*Not implemented — a recommendation.*

Give the `preview` build its own identity so staging and prod install side by
side, and staging builds can never reach your friends' TestFlight group by
mistake.

- Convert `app.json` to `app.config.ts` and switch on an `APP_VARIANT` set in
  each `eas.json` profile:

  | Variant | Name on the home screen | iOS bundle ID / Android package |
  |---|---|---|
  | `production` | Band Wall | `com.bandwall.app` |
  | `staging` | Band Wall (Staging) | `com.bandwall.app.staging` |
  | `development` | Band Wall (Dev) | `com.bandwall.app.dev` (optional) |

- A different icon tint or badge for staging makes them easy to tell apart.
- It costs a second App Store Connect app and Play Console app (no extra fee),
  and a second set of credentials, which `eas credentials` creates.
- Push keeps working: the APNs key is per Apple team, and Expo push tokens are
  per install.
- Giving the dev client its own ID too means all three can live on one phone.
  It changes the dev client's identity, so it needs one fresh
  `npm run mobile:ios`.
