# `apps/mobile` — Band Wall on iOS and Android

Expo SDK 57 / React Native 0.86, expo-router, React Native `StyleSheet`. A
third app beside `apps/web`, sharing `packages/shared` and
`packages/api-client` as TypeScript source.

Plan and phase tracker: [`docs/mobile-app.md`](../../docs/mobile-app.md).
Conventions for writing code here: [`AGENTS.md`](AGENTS.md).

## Running it on a phone

**A phone is not your laptop.** `localhost` on a phone is the phone. In a dev
build the API and Supabase URLs default to the address Metro is served from,
which Expo picks afresh on every `expo start` — so on a new network (another
Wi-Fi, a phone hotspot) restart `npm run mobile` and scan the new QR. Set
`EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SUPABASE_URL` in `.env` only to point
somewhere else; set, they win.

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Nothing to fill in for local dev: the URLs default to Metro's address.
```

Then, with the stack up (`npx supabase start`, `npm run dev`):

```bash
npm run mobile                  # from the repo root — expo start
```

This serves the **Band Wall development build**, not Expo Go — since P13
(push), `expo-notifications` needs a real build, so the project carries
`expo-dev-client`. Install the build once with the iPhone plugged in (Developer
Mode on):

```bash
npm run mobile:ios              # from the repo root — expo run:ios --device
```

Then open Band Wall: Metro on the same Wi-Fi is listed under *Development
servers*, and after the first time under *Recently opened*. The terminal's QR
code (iPhone Camera) opens it too. Rebuild only when native code changes — a
package with native code, native settings in `app.json`, an SDK upgrade.

Phone and laptop must be on the same Wi-Fi. CORS is not involved: React
Native's `fetch` is not a browser and sends no `Origin`, so the API's
`enableCors({ origin: WEB_URL })` does not need to know about the phone.

### On any other network: `npm run mobile:tunnel`

Public Wi-Fi usually isolates devices from each other, and an IPv6-only
hotspot (T-Mobile's, for one) gives the laptop an IPv4 address — `192.0.0.2` —
that nothing else can dial, so the app cannot reach Metro. On iOS that shows
up on scanning as *"The resource could not be loaded because the App Transport
Security policy requires the use of a secure connection"*: `192.0.0.2` is not a
private address, so ATS will not allow plain HTTP to it. Loosening ATS would not
help, since the phone still could not reach that address. Tunnel instead:

```bash
npm run mobile:tunnel           # from the repo root; stop `npm run mobile` first
```

[`tunnel.sh`](../../tunnel.sh) starts Supabase and the API if they are not
already up, opens ngrok tunnels for the API (3001), Supabase (54321) and Metro
(8081), starts Expo with those URLs, and prints its own QR code — scan that one
(iOS: the Camera app). Ctrl+C stops everything it started.

- **Needs ngrok, logged in:** `brew install ngrok`, then
  `ngrok config add-authtoken <token>`. It runs three tunnels at once. Your
  own `ngrok.yml` is read for the token, never edited.
- **Or Cloudflare, no account:** `npm run mobile:tunnel:cf` (or
  `TUNNEL_PROVIDER=cloudflare npm run mobile:tunnel`) opens three Cloudflare
  quick tunnels instead — `brew install cloudflared`, no login, no bandwidth
  cap. Use it when ngrok's free plan runs out of data. The
  `*.trycloudflare.com` URLs are new every run, so scan the fresh QR each time.
- **Expo already running?** `METRO_PORT=8082 npm run mobile:tunnel` runs this
  Metro beside it instead of asking you to stop it.
- **Supabase is tunnelled too**, because attachment previews and downloads
  are signed Storage links the phone opens directly. Sign-in goes through the
  API.
- **`.env` is not edited.** The tunnel URLs are set on Expo's process, and Expo
  never lets `.env` overwrite a variable that is already set.
  `EXPO_PACKAGER_PROXY_URL` points the manifest at the
  Metro tunnel.
- **Two QR codes, side by side:** the development build's
  (`artistdashboard://expo-development-client/?url=<Metro tunnel>`) and Expo
  Go's (`exps://…`, Expo Go's https scheme — no push there). Expo's own
  QR would carry the LAN address, which is why Expo runs in the background and
  its QR is not shown. The Metro tunnel URL is printed too, for the launcher's
  *Enter URL manually*.
- **Same address every run:** ngrok gives each account one free static domain
  (ngrok dashboard → Domains). `NGROK_METRO_DOMAIN=<it>.ngrok-free.app npm run
  mobile:tunnel` pins Metro to it, so *Recently opened* keeps working without a
  new scan. The API and Supabase URLs can still change; they are inlined into
  each run's bundle.
- **No keyboard shortcuts** — shake the phone → Reload. Each run starts Metro
  with `--clear`, since the URLs are new every time and inlined at bundle time,
  so the first load is slow.
- Logs (API, the tunnels, Expo) go to a temp folder whose path is printed.

⚠️ This puts your local Supabase and API on the public internet, and the local
Supabase stack runs on well-known default secrets. Stop it when you're done.

## How this app is wired

| Concern | Where | Note |
|---|---|---|
| Monorepo resolution | [`metro.config.js`](metro.config.js) | `watchFolders` + `nodeModulesPaths`; read the comment before touching it |
| Config | [`src/lib/env.ts`](src/lib/env.ts) | `EXPO_PUBLIC_*`, inlined by Babel, validated in one place |
| Session storage | [`src/lib/chunked-store.ts`](src/lib/chunked-store.ts) | keychain, `AFTER_FIRST_UNLOCK`; chunked because SecureStore caps a value at 2048 bytes |
| Auth client | [`src/lib/auth.ts`](src/lib/auth.ts) | the shared Better Auth `AuthClient` over that store; screens only use `auth` |
| API client | [`src/lib/api-client-setup.ts`](src/lib/api-client-setup.ts) | mirrors `apps/web/src/lib/api-client-setup.ts` |
| Auth gate | [`src/app/_layout.tsx`](src/app/_layout.tsx) | `Stack.Protected`, splash held until the session is read |

Routes live in `src/app` and contain nothing but a screen; screen bodies live in
`src/screens`, per the `expo-project-structure` skill.

## Auth

Email and password, the same as the web app, against Better Auth in the API
(`/api/auth`). The one email the product sends for sign-in is the invite: its
link opens the web's `/auth/callback`, and it also carries a 6-digit code,
which "Join with an invite code" on the sign-in screen accepts, so a bandmate
can join from the phone too.

Screens never call the provider directly. They use `auth` from
[`src/lib/auth.ts`](src/lib/auth.ts), an `AuthClient` from
`@artist/api-client` (`signIn`, `signUp`, `signOut`, `setPassword`,
`verifyInviteCode`, `getSession`, `onSessionChange`). The Better Auth version
lives in `packages/api-client/src/auth/better-auth-client.ts`. The session is a
token kept in the keychain and sent as a bearer token; it lasts 30 days and
extends while used, so there is no refresh timer (the background refresh
switches are no-ops).

## Typed routes are off

`experiments.typedRoutes` is `false` in `app.json`, and it is not a preference:
with it on, **`expo start` crashes outright**. Type generation runs inside
`@expo/cli`, which npm installs under the repo root (`node_modules/expo/
node_modules/@expo/cli`), and it `require`s `expo-router/_ctx-shared`. npm
nests `expo-router` in `apps/mobile/node_modules` because of a `react-is`
conflict with the root's test tooling, so Node walking up from the CLI never
reaches it.

The cost is that `<Link href="...">` strings are not checked against the route
tree, so a typo is a dead tap rather than a compile error. Forcing the hoist
with an `overrides` entry was tried and did not move `expo-router`; a fix needs
either Expo to resolve this through the project root or the dependency conflict
to go away.

## Deliberate deviations from the Expo defaults and latest versions

Each would otherwise read as an oversight:

- **`react` is pinned to `19.2.4`**, not the `19.2.3` the SDK ships with, to
  match `apps/web`'s exact pin. Two different pins means npm installs two
  copies of React, and because `packages/api-client` resolves from the repo
  root while app code resolves from here, the hooks and the component tree
  would get different ones. React Native 0.86 peers `^19.2.3`, so 19.2.4 is
  inside its range.
- **`jest` is 30**, not the `~29.7.0` the SDK expects, matching the other three
  workspaces. These tests are plain `ts-jest` units in a Node environment, not
  `jest-expo`, so the preset's version requirement does not apply.
- **`react-native-purchases` and `react-native-purchases-ui` are pinned to
  exactly `10.16.0`**, not the latest 11.x (approved 2026-10-29). 11.0.0 needs
  the iOS pod `PurchasesHybridCommon` 20.1.0, which wasn't published to
  CocoaPods, so `pod install` failed. TODO: upgrade once it is; see
  [docs/billing.md](../../docs/billing.md).
- `react` and `jest` are listed in `expo.install.exclude` so `expo install --check` and
  `expo-doctor` stay green and a real mismatch is still visible.

## Tests

`npm test -w apps/mobile` typechecks (`tsc --noEmit`) and then runs units.
They are plain `ts-jest` tests of logic pulled out of the screens (the chunking
store, dev-host detection, push routing and token changes, reorder, note
editing, finance drafts and so on). Nothing here renders a component, so how a
screen looks and behaves is checked on a phone, per
[docs/test-checklist.md](../../docs/test-checklist.md).

## EAS build profiles

[`eas.json`](eas.json) has three profiles, and each sets `EXPO_PUBLIC_APP_ENV`
so logs and error reports know where they came from (see
[docs/error-handling.md](../../docs/error-handling.md)):

| Profile | Use | `EXPO_PUBLIC_APP_ENV` |
|---|---|---|
| `development` | The dev client you install once with `npm run mobile:ios` | `development` |
| `preview` | Internal-distribution build for testing against staging | `staging` |
| `production` | Store build, build number auto-incremented | `production` |

How these builds reach testers, and what still needs setting up before the
first staging or beta build, is in
[docs/release-workflow.md](../../docs/release-workflow.md).

`EXPO_PUBLIC_SENTRY_DSN` turns on error reporting, but only in a build made
after the `@sentry/react-native` plugin was added (October 2026).
