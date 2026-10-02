# `apps/mobile` — Artist Dashboard on iOS and Android

Expo SDK 57 / React Native 0.86, expo-router, React Native `StyleSheet`. A
third app beside `apps/web`, sharing `packages/shared` and
`packages/api-client` as TypeScript source.

Plan and phase tracker: [`docs/mobile-app.md`](../../docs/mobile-app.md).
Conventions for writing code here: [`AGENTS.md`](AGENTS.md).

## Running it on a phone

**A phone is not your laptop.** `localhost` on a phone is the phone, so every
URL in `.env` has to be the LAN address of the machine running the stack — this
is the single most common reason the app comes up but can't sign in.

```bash
cp apps/mobile/.env.example apps/mobile/.env
ipconfig getifaddr en0          # your LAN IP, e.g. 192.168.1.10
npx supabase status             # the anon key goes in .env
```

Then, with the stack up (`npx supabase start`, `npm run dev`):

```bash
npm run mobile                  # from the repo root — expo start
```

Scan the QR code with **Expo Go**. No development build is needed yet: every
native module this app uses (`expo-secure-store`, `expo-router`, Reanimated,
Gesture Handler, Screens, Safe Area Context) ships inside Expo Go. That changes
at P13, when push notifications arrive — `expo-notifications` cannot receive
remote push in Expo Go, so that phase needs `expo-dev-client` and a real build.

Phone and laptop must be on the same Wi-Fi. CORS is not involved: React
Native's `fetch` is not a browser and sends no `Origin`, so the API's
`enableCors({ origin: WEB_URL })` does not need to know about the phone.

## How this app is wired

| Concern | Where | Note |
|---|---|---|
| Monorepo resolution | [`metro.config.js`](metro.config.js) | `watchFolders` + `nodeModulesPaths`; read the comment before touching it |
| Config | [`src/lib/env.ts`](src/lib/env.ts) | `EXPO_PUBLIC_*`, inlined by Babel, validated in one place |
| Session storage | [`src/lib/chunked-store.ts`](src/lib/chunked-store.ts) | SecureStore caps a value at 2048 bytes; a Supabase session is bigger |
| Supabase client | [`src/lib/supabase.ts`](src/lib/supabase.ts) | keychain storage, `detectSessionInUrl: false` |
| API client | [`src/lib/api-client-setup.ts`](src/lib/api-client-setup.ts) | mirrors `apps/web/src/lib/api-client-setup.ts` |
| Auth gate | [`src/app/_layout.tsx`](src/app/_layout.tsx) | `Stack.Protected`, splash held until the session is read |

Routes live in `src/app` and contain nothing but a screen; screen bodies live in
`src/screens`, per the `expo-project-structure` skill.

## Auth

Email and password, the same as the web app. Not magic links: the one magic
link the product sends is a Supabase *invite*, and the API hardcodes its
redirect to `WEB_URL/auth/callback`. An invited bandmate accepts on the web,
sets a password there, and signs in here with it.

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

## Three deliberate deviations from the Expo defaults

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
- Both are listed in `expo.install.exclude` so `expo install --check` and
  `expo-doctor` stay green and a real mismatch is still visible.

## Tests

`npm test -w apps/mobile` typechecks (`tsc --noEmit`) and then runs units.
Nothing here renders a component yet: the one thing worth testing in this phase
is the chunking store, which is pure logic because its backend is injected.
