# Mobile App (React Native + Expo)

> **Status:** in progress. P0–P4 done and verified; **P5–P8 built, awaiting
> verification on a phone** — `apps/mobile/` signs in, has its four tabs, and
> every widget reads end to end: hub card → spoke → task. Nothing writes yet.
> P9 (calendar + inbox) is next.
>
> **Progress is tracked in [the phase table](#phases).** Update the Status
> column in the same commit that lands the work. ☑ done and user-verified ·
> ◐ in progress or partially done · ☐ not started.

A native iOS/Android app built with Expo, sharing the existing NestJS API. It is
a **third app alongside `apps/web`, not a replacement** — web keeps the desktop
experience, the landing page, and SEO.

## Locked decisions

These were settled in planning. Don't re-litigate them without a reason that
has changed.

| Decision | Choice | Why |
|---|---|---|
| Runtime | **Expo / React Native** (not PWA, not Capacitor) | A genuinely native feel was non-negotiable. Accepted cost: the UI layer is rewritten, not ported. |
| Scope | **Full parity** with web | Every feature reachable on mobile, including layout editing and the notes widget. |
| Styling | **React Native `StyleSheet`** | NativeWind was considered and declined. Costs more mechanical work (every `className` is rewritten) but no magic and a better fit for a phone-only layout than a 12-column utility system. |
| Push | **Designed up front**, not retrofitted | The channel seam goes into the data model (P2) before the app exists. |
| Event widgets | **Three separate cards** (Shows / Rehearsals / Meetings) | True parity with the web layout. Self-solving if repetitive: `LayoutItem.hidden` already lets a user hide two. |
| Bottom nav | **Board · Calendar · Inbox · You** | Four tabs. Archive and widget management live behind the hub's `⋯`. |
| Cross-board | **Calendar and Inbox aggregate** across boards; Board does not | "Board is where you work, Calendar and Inbox are where you catch up." |
| Web migration | **Additive API changes**, web updated later as its own phase | Keeps mobile unblocked and each phase small enough to verify. |

## Architecture

```
apps/api            + push channel, DeviceToken, multi-board + cross-board endpoints
apps/web            unchanged except P1 (refactor) — see "Blast radius"
apps/mobile         NEW — Expo, expo-router, StyleSheet
packages/shared     unchanged — Zod DTOs, can(), layout merge, enums, statuses, theme
packages/api-client NEW — apiFetch + the ~19 TanStack Query hooks, platform-agnostic
```

`packages/api-client` is the keystone: extracting the hooks hands the mobile app
the data layer — cache keys, optimistic updates, invalidation — and makes a
server contract change a one-place fix.

**An audit of all 19 hooks corrected an early assumption.** They are not
web-free. Findings:

| Finding | Count | Consequence |
|---|---|---|
| Import `toast` from **`sonner`** | 12 | Dominant blocker. `sonner` is a DOM renderer with no RN build (`sonner-native` is a separate, API-incompatible package). Inverting one notifier unblocks all 12. |
| Cleanly portable, move as-is | 4 | `use-activity`, `use-me`, `use-calendar`, `use-can-change-status` |
| Read `process.env.NEXT_PUBLIC_*` | **0 hooks** | Config injection is a 2-file problem (`lib/api.ts`, `lib/supabase.ts`), not a 19-file one |
| Import `next/*` | **1** | Only `use-detail-params.ts` (`next/navigation`) |

Three specifics worth keeping in mind:

- **`Omit<RequestInit, 'body'>` is a `lib.dom` type.** Reusing it would make the
  package fail to typecheck in a DOM-free RN tsconfig, so `ApiFetchInit` is
  hand-rolled with just the fields the call sites pass.
- **`URLSearchParams` is a false alarm.** Three hooks use it, but only as a
  query-string builder (`new`/`set`/`toString`), all within RN's polyfill. The
  one member to avoid is `.size`, used only in the web-only
  `use-detail-params.ts`.
- **`use-can-change-status.ts` cannot move alone** — it depends on
  `features/auth/permissions.tsx`, which is itself platform-agnostic
  (context + `can()`, no DOM) and must co-move. That means **the package needs
  JSX compilation**, not just plain `.ts`.

Two things must be injected so the package stays platform-neutral:

- **Token source.** `apps/web/src/lib/api.ts` imports `supabase` and calls
  `auth.getSession()` directly. Invert it:
  `createApiClient({ baseUrl, getAccessToken })`. Web passes its browser
  Supabase client; mobile passes one backed by `expo-secure-store`.
- **Base URL.** `process.env.NEXT_PUBLIC_API_URL` becomes a constructor arg;
  mobile reads it from `expo-constants`.

`packages/shared` is consumed as **TS source** by both apps (tsconfig `paths` +
`transpilePackages`). Metro needs the equivalent via `monorepoRoot` watch
folders — expect this to be the first thing that breaks in P5.

### Blast radius on `apps/web`

Nine of the fifteen phases never open `apps/web`. The three that do:

| Phase | What changes in web | Avoidable? |
|---|---|---|
| P1 | **26 files** change their `apiFetch` import; **15 hook files** move out of `features/` (+ `permissions.tsx` and 7 `types.ts`); `lib/api.ts` is replaced by a factory | No — the extraction *is* a web refactor. Behaviour-neutral by definition; the web Jest suite is the check. |
| P2 | 3 files touch `EmailCategory` (`notifications-card.tsx`, `settings-page.tsx`, `unsubscribe/page.tsx`) | Yes — keep `export type EmailCategory = NotificationCategory` as an alias. |
| P3 | **15 files** import `useMe`/`MeResponse`; **6 read `.board` directly**, incl. `app-shell.tsx`, which gates the whole authed app on `me.data.board` being non-null | Yes — add `boards[]` while keeping `board` populated with the first membership. |

Deferred consequence: a user in three bands on web will silently see only the
first one. That is a real bug, and closing it is **P15 (web board switcher)**,
deliberately scheduled after mobile rather than blocking it.

## Phases

| # | Phase | Touches | Status |
|---|---|---|---|
| **P0** | [Groundwork](#p0--groundwork) — skills, docs, branch | tooling | ☑ |
| **P1** | [`packages/api-client` extraction](#p1--packagesapi-client-extraction) | shared, **web** | ☑ |
| **P2** | [Notification channels + push transport](#p2--notification-channels--push-transport) | api, shared | ☑ |
| **P3** | [Multi-board API](#p3--multi-board-api) | api, shared | ☑ |
| **P4** | [Cross-board calendar + inbox](#p4--cross-board-calendar--inbox) | api, shared | ☑ |
| **P5** | [Expo skeleton + auth on a real device](#p5--expo-skeleton--auth-on-a-real-device) | mobile | ◐ |
| **P6** | [Primitives + design tokens](#p6--primitives--design-tokens) | mobile, **shared** | ◐ |
| **P7** | [Board hub (stat cards)](#p7--board-hub-stat-cards) | mobile, **shared** | ◐ |
| **P8** | [Spokes (expanded widgets)](#p8--spokes-expanded-widgets) | mobile, **shared** | ◐ |
| **P9** | [Calendar + Inbox screens](#p9--calendar--inbox-screens) | mobile | ☐ |
| **P10** | [Write parity](#p10--write-parity) | mobile | ☐ |
| **P11** | [Notes widget](#p11--notes-widget) | mobile | ☐ |
| **P12** | [Mobile layout editor](#p12--mobile-layout-editor) | mobile | ☐ |
| **P13** | [Push client](#p13--push-client) | mobile, api | ☐ |
| **P14** | [Store builds](#p14--store-builds) | mobile, CI | ☐ |
| **P15** | [Web board switcher](#p15--web-board-switcher) | **web** | ☐ |

Each phase ends with a **hard stop for manual verification** before the next
begins, per the project's phase-gated convention. What to verify is tracked
separately in the [feature test checklist](test-checklist.md) — this table
records what has been *built*, that one records what has been *seen working*.

P1–P4 are API and package work that require no React Native decisions. They are
safe to build first and are useful even if the runtime choice ever changed.

---

### P0 — Groundwork

| Item | Status |
|---|---|
| Install Expo/RN skills, directory-scoped to `apps/mobile/.claude/skills/` | ☑ |
| Record the locked decisions and the IA design (this document) | ☑ |
| `apps/mobile/AGENTS.md` + `CLAUDE.md` mirroring the `apps/web` warning | ☑ |
| Add a skills section for mobile to the root `CLAUDE.md` | ☑ |
| Move the untracked `apps/mobile/` onto a `feat/mobile-app` branch and commit | ☑ |

**17 skills installed** (version-pinned, `skills-lock.json`, security scans
clean). Directory-scoped so they stay inert while editing `apps/web` — several
carry opinions that would be wrong advice for the Next app.

Official Expo (15): `expo-overview`, `expo-project-structure`, `expo-router`,
`expo-dev-client`, `expo-web-to-native`, `expo-data-fetching`,
`expo-design-system`, `expo-native-ui`, `expo-animation`, `expo-upgrade`,
`eas-app-stores`, `eas-update`, `eas-workflows`, `eas-simulator`.
Third-party (3): `animate-expo` (Emil Kowalski), `vercel-react-native-skills`,
`upgrading-react-native` (Callstack).

Deliberately **not** installed: `expo-tailwind-setup` (would push toward
NativeWind, against the styling decision), `expo-ui` /
`expo-ui-jetpack-compose` (SwiftUI/Compose bindings fight a single
cross-platform codebase), `use-dom` / `expo-dom` (reintroduces a webview — the
thing Expo was chosen over), `expo-api-routes` (duplicates NestJS),
`expo-brownfield`, `expo-app-clip`, `expo-module`.

**Two skill gaps, both on high-risk phases.** No skill exists for Expo push
notifications (P13) or for `expo-secure-store` / auth session handling (P5).
Those run on Expo's own docs — budget extra on-device verification rather than
trusting recall.

### P1 — `packages/api-client` extraction

Move `apiFetch` and the portable query hooks into a new workspace package;
point `apps/web` at it. Invert the three platform dependencies: base URL, token
source, and — per the audit — the **notifier**.

Pure refactor. **Done means: `apps/web` behaves identically and its Jest suite
is green.** No feature work, no UI change. Largest single web diff in the
project, and the highest-leverage move in it.

**What moves (15 hooks):** the 4 cleanly portable ones, plus the 11 whose only
web dependency is `sonner`. Co-moving: `features/auth/permissions.tsx` and the
7 feature-local `types.ts` files (all clean, but their `@/*` path aliases need
rewriting to package-relative).

**What stays in `apps/web` (2):**

- `use-detail-params.ts` — the hook *is* URL-as-UI-state. Native has no `?query`
  bar; the Expo equivalent is `expo-router`'s `useLocalSearchParams`, and
  `{ scroll: false }` is meaningless there. Reimplement per platform behind a
  shared interface rather than moving it.
- `use-grid-resize-guard.ts` — mechanically portable but semantically empty on
  native: its contract is `react-grid-layout`'s resize callbacks and its payoff
  is a CSS `select-none` to suppress drag-text-selection. Not a data hook.

**What is deliberately deferred (2),** because each needs its *native*
counterpart written before the abstraction can be designed honestly:

- `use-attachments.ts` → **P10.** Three browser-only dependencies, one of them a
  real behavioural break rather than a type error: it passes a raw `File` as a
  `PUT` body, and RN's `fetch` cannot stream a `file://` URI that way. Needs
  `expo-file-system`'s `uploadAsync` or a `{ uri, name, type }` FormData. Also
  `File` as the mutation input type and `window.open` in `downloadAttachment`.
  The three-step signed-URL flow and `MAX_ATTACHMENT_BYTES` guard are sound and
  stay; only the byte-transfer primitive and URL-opener get injected.
- `use-session.ts` → **P5.** The body (getSession + onAuthStateChange +
  unsubscribe) is already platform-agnostic; it just imports the web Supabase
  singleton. Moving it is trivial *after* P5 builds the RN client with a
  secure-store adapter and `detectSessionInUrl: false`.

Rejected alternative: copy the hooks into the package and leave web on its own
copies. Two divergent data layers is exactly the tax the package exists to
prevent.

**Built (commits `8229103`, `ad4184a`).** 23 files moved as git renames, so
history is preserved. Verified: `tsc` clean on both web and the package,
`next build` green across all 11 routes, web lint clean, 10 + 159 + 54 tests
passing.

Two things the package's own DOM-free tsconfig caught that the web build had
waved through — both are the reason it exists:

- `Omit<RequestInit, 'body'>` as the fetch init type. `RequestInit` is
  `lib.dom`; it compiled only because web's tsconfig includes `"dom"`.
- An unchecked `data.message` read on an error body. Outside `lib.dom`,
  `response.json()` is `unknown`, not `any`, so the access is now narrowed.

A review pass then found the guards themselves weren't wired: the package's
jest had no `tsx` support (so `index.ts` was untestable and the suite was green
only by accident), and `tsc -p packages/api-client` was run by no script — a
`lib.dom` leak would have passed `next build` *and* jest and failed only at
Metro time. `npm test` in the package now typechecks first, and a barrel spec
guards resolution. `"use client"` was also restored on the 16 runtime modules,
since `app/layout.tsx` is a server component and the directive is a no-op under
Metro.

Rejected alternative: copy the hooks into the package and leave web on its own
copies. Two divergent data layers is exactly the tax the package exists to
prevent.

**Built (commits `8229103`, `ad4184a`).** 23 files moved as git renames, so
history is preserved. Verified: `tsc` clean on both web and the package,
`next build` green across all 11 routes, web lint clean, 10 + 159 + 54 tests
passing.

Two things the package's own DOM-free tsconfig caught that the web build had
waved through — both are the reason it exists:

- `Omit<RequestInit, 'body'>` as the fetch init type. `RequestInit` is
  `lib.dom`; it compiled only because web's tsconfig includes `"dom"`.
- An unchecked `data.message` read on an error body. Outside `lib.dom`,
  `response.json()` is `unknown`, not `any`, so the access is now narrowed.

A review pass then found the guards themselves weren't wired: the package's
jest had no `tsx` support (so `index.ts` was untestable and the suite was green
only by accident), and `tsc -p packages/api-client` was run by no script — a
`lib.dom` leak would have passed `next build` *and* jest and failed only at
Metro time. `npm test` in the package now typechecks first, and a barrel spec
guards resolution. `"use client"` was also restored on the 16 runtime modules,
since `app/layout.tsx` is a server component and the directive is a no-op under
Metro.

### P2 — Notification channels + push transport

The dispatcher already sits behind a swappable `MailTransport`
(`smtp`/`resend`/`noop`), so the **seam exists**. What is email-shaped is the
data model.

- `EmailCategory` → `NotificationCategory` (the four categories are already
  channel-neutral). Keep an `EmailCategory` alias so web compiles untouched.
- `NotificationPreference` is uniquely keyed `[boardId, userId, category]`. Add
  `channel`, so someone can take assignments as push but digests as email.
- New `DeviceToken` model: `userId`, `token`, `platform`, `lastSeenAt`. Expo
  Push fronts both APNs and FCM, so there is one send endpoint.
- `PushTransport` alongside the mail transports; the dispatcher fans out per
  enabled channel.
- Leave `EmailDelivery` / `EmailSuppression` alone and add a parallel push
  delivery log. Bounce and complaint semantics genuinely do not apply to push,
  where the failure mode is an expired device token.

Doing this before the app exists means the mobile client ships against a server
that is already ready for it.

**Built.** 17 new API tests; `docs/notifications.md` carries the full channel
design. Three deviations from the plan above, all deliberate:

- **One outbox, not a parallel `PushDelivery`.** Reading the dispatcher changed
  my mind: the claim/backoff/drain machinery is concurrency-sensitive and a
  second copy would be a second place to get multi-instance safety wrong. The
  per-channel differences — transport, and what "undeliverable" means — were
  already seams. `NotificationDelivery` gained a `channel` instead.
- **No `EmailCategory` alias was needed.** `packages/shared` already exported
  its own `NotificationCategory`, deliberately decoupled from the Prisma enum
  because `DUE_TASKS` was cut. The Prisma enum appeared in only two API files,
  so **P2 touched zero web files** — better than planned.
- **The preferences DTO is unchanged.** `NotificationPreference` carries a
  channel, but the existing endpoint reads and writes `EMAIL` explicitly, so
  `apps/web` needed no edit. The push dimension surfaces in P13, when there is
  a screen for it.

Two things worth knowing for later phases:

- **`prisma migrate dev` wanted to DROP `EmailDelivery`** and recreate it under
  the new name — 33 rows, including the dedupe history that stops already-sent
  mail going again. The migration is hand-written with `ALTER TABLE … RENAME`;
  `migrate diff` confirms no drift. Any future rename in this repo needs the
  same `--create-only` inspection.
- **`expo-server-sdk` is unusable here.** It is ESM-only and ts-jest cannot
  require it, the same wall this codebase already hit with svix.
  `ExpoPushTransport` uses `fetch` against the endpoint and shapes read off
  `expo-server-sdk@7.2.0`.

Also fixed in passing: `apps/api`'s `npm test` ran `jest` only, and ts-jest here
does not typecheck — so the suite could pass while `tsc` failed. It genuinely
did during this phase. The script now typechecks first, matching
`packages/api-client`.

A review pass then found six holes, two serious enough to record here because
they are the kind that would have shipped quietly:

- **Push tokens were globally unique**, so registering an existing token
  reassigned it — knowing someone's token was enough to redirect their
  notifications to your account and silence their phone. Now unique per user,
  and `register` never writes `userId` on update.
- **Muting a category did not stop push.** Preferences and the unsubscribe link
  only ever write `EMAIL` rows, while the dispatcher read the row's own channel.
  A push row now falls back to the email preference.
- The transport sent `id` as an idempotency key; **Expo's message format has no
  such field** — `id` is on the ticket it returns. Now sends `collapseId`, and
  both code and spec say plainly that push has no idempotency guard.
- `deliverPush` returned early on an empty device list and the row was then
  stamped `SENT`, recording a delivery that never happened.

Lesson carried forward: both dispatcher fixes were mutation-tested (break the
code, confirm a test fails) before being called done. Worth repeating on P4,
where the failure mode is a cross-board data leak.

### P3 — Multi-board API

The schema already supports multi-board — `Membership` is a proper join table
with `@@index([userId])`. The **API collapses it on purpose**:
`users.service.ts` does `const membership = user.memberships[0] ?? null`, and
`MeResponse` exposes a singular, nullable `board`.

- `GET /boards` — the caller's boards with their per-board role.
- `boards[]` on `/me`, **keeping `board` populated** with the first membership
  so the 15 web files that consume it keep working.
- Role resolution becomes per-board rather than one global role.

Gates the entire mobile IA — the header board switcher, and every screen that
names which board an item belongs to.

**Built.** 11 new API tests; `apps/web` entirely untouched and still builds,
which was the point of the additive approach.

- `GET /boards` returns `BoardSummaryDto[]` — id, name, membershipId, role.
  Deliberately light: a switcher needs a name and a role, not a layout and a
  palette, so listing twenty bands does not fetch twenty themes.
- `boards[]` on `/me`, oldest-first, with `membership` and `board` still
  populated from `boards[0]`.
- `BoardSummaryDto` lives in `packages/shared`, so the API and the client cannot
  drift on its shape.

**`GET /boards` is the first route in the codebase with no board id to guard
on.** `BoardRolesGuard` reads a `:boardId`/`:id` param, so it cannot run here —
the service's `where: { userId }` is the entire authorisation. That is exactly
P4's situation, and this route is the small version of it. Both guarantees were
mutation-tested: removing the `userId` scope fails a test, and making the legacy
`board` field point anywhere but `boards[0]` fails another.

The role is **per board**. Someone can be admin of their own project and an
ordinary member of someone else's, so there is no "the user's role" to cache —
only their role *here*. Any mobile screen reading a role must read it from the
board it is showing.

A review pass over P2 and P3 together found four more holes, all in the push
path and all recorded in `docs/notifications.md`: a 200-with-`errors` reply read
as a clean send (notification lost silently), ticket-to-token matching that
trusted position without a length check (could delete a live device), the
device-handover content leak that scoping tokens per user had opened, and push
`data` carrying no entity id so a tap could only reach the board root. Each fix
was mutation-tested.

### P4 — Cross-board calendar + inbox

**This is the one phase where a mistake leaks another band's data.** Read it
before writing any of it.

Every protected route today is single-board *by construction*:
`BoardRolesGuard` reads a `:boardId`/`:id` route param and does one
`membership.findUnique`. Both controllers that need to go cross-board are
mounted under that param (`boards/:boardId/calendar`,
`boards/:boardId/mentions`) with a class-level `@BoardRoles('USER')`.

A cross-board endpoint has no `:boardId`, so **it cannot use that guard at
all.** Authorization moves from "the guard verifies one board" to "the service
constrains the query to the caller's membership set."

- New top-level `GET /calendar` and `GET /mentions`.
- A single reusable `@UserBoards()` param decorator resolves the membership set
  once, so the `IN` clause is never hand-written per endpoint.
- `DELETE /mentions` for clear-all — the existing clear is per-board, so this
  is a new endpoint, not a reuse.
- Every item in both responses carries a `board` discriminator (id, name,
  colour) so the UI can label and filter.
- **Jest units that assert a non-member's board never appears in either
  response.**

Data notes: `MentionNotification` is indexed `@@index([userId, createdAt])` —
already user-first, so a cross-board inbox sorted by recency is the index's
natural shape, no migration. `Event` and `Reminder` are board-first
(`[boardId, startsAt]`, `[boardId, remindAt]`), so a cross-board range becomes
`boardId IN (...) AND startsAt BETWEEN ...`; Postgres serves that with an index
scan per board value and nobody in 1–5 bands will notice. No new index needed —
just don't let the client turn it into an N+1 of per-board calls.

**Built.** `GET /calendar`, `GET /mentions` and `DELETE /mentions`, each behind
`UserBoardsGuard` + `@UserBoards()`. 64 new API tests; every leak path
mutation-tested.

### The leak this phase nearly introduced

An audit of the existing scoping found it, and it is worth recording because the
wrong answer looked like the obvious one.

`MentionNotification` rows carry a **snapshotted `taskTitle` and comment
`excerpt`** — the board's own text, stored so the row survives the comment being
edited. `removeMember` cleaned `membership`, `userLayout` and `taskAssignee`,
but **not** these rows. That was invisible because `BoardRolesGuard` 404s on the
missing membership before `MentionsService` ever runs: the guard was *masking*
stale rows, not an absence of them.

These rows are addressed to a person, so scoping the new route by `userId` alone
reads as complete — and the existing code's own framing ("the recipient's
notifications", "scoped to the recipient so ids can't leak") invites exactly
that. It would have handed an **ex-member another band's content indefinitely**,
re-fetched every thirty seconds by the polling client already in production.

Both fixes landed: `removeMember` now deletes those rows, and every mentions
query filters on `userId` **and** the board set. The board filter is the
load-bearing one — it re-derives access from live membership on every request
rather than trusting a cleanup to have happened, the same reasoning as the
dispatcher's send-time membership re-check.

### Why the seam is shaped the way it is

**`{ in: undefined }` is not an empty filter — it is no filter.** Verified
against the dev database: it returned every board, while `{ in: [] }` returned
none. So a handler that received `undefined` would silently query every band in
the system. Three things make that unexpressible:

- `resolveUserBoards()` **throws** rather than return `undefined`, turning a
  forgotten `@UseGuards` into a 500 on the first request instead of a leak.
- Both services take `boardIds: string[]` — never `string`, never optional — so
  the type system rejects the unsafe call. It rejected all five existing callers
  on the first compile.
- `narrowToBoard()` applies the optional `?boardId=` filter by **intersection**,
  so an id the caller does not belong to yields `[]`. The tempting
  `query.boardId ?? boardIds` would hand a client value straight into the
  `where` clause.

Calendar items and mention rows now carry `boardId` and `boardName`: merged
across bands, two items called "Load in" are otherwise indistinguishable, and
neither can be linked to.

Also fixed in passing — `CurrentUser()` cast away an optional, so a misplaced
`@Public()` produced a confusing 500 far from its cause; the calendar window was
unbounded and now caps at 370 days, which matters more now the range fans out
per board; and its `to > from` check compared ISO *strings*, which only tracks
chronological order while both sides have equal precision.

### P5 — Expo skeleton + auth on a real device

`apps/mobile` with expo-router, Metro wired to the monorepo, and **nothing else
but working auth on physical hardware.** This is the de-risking phase; resist
adding screens.

**Magic links are the sharp edge.** `apps/web/src/features/auth/callback-page.tsx`
assumes a browser redirect to `/auth/callback`. Mobile needs:

1. A custom URL scheme or universal link in the Expo config.
2. That URL added to Supabase's redirect allow-list. (Precedent from P1 of the
   MVP: GoTrue *silently* drops a `redirectTo` that isn't allow-listed and
   lands tokens on `/` instead — so a failure here looks like a bug elsewhere.)
3. `expo-auth-session` / `expo-linking` to catch the inbound link.
4. `expo-secure-store` as the Supabase `auth.storage` adapter, so sessions
   survive app kill. `supabase-js` defaults to `localStorage`, which does not
   exist here.

A dev client is required (`expo-dev-client`) — native dependencies mean Expo Go
will not do.

**Done means: magic-link sign-in works end to end on a physical phone, and the
session survives force-quitting the app.**

**Built.** Expo SDK 57 / React Native 0.86, expo-router, `StyleSheet`, routes in
`src/app` holding nothing but a screen. Metro bundles 1277 modules for iOS and
1423 for Android including `@artist/api-client` and `@artist/shared` as
TypeScript source; `expo-doctor` passes 21/21; 13 new units. The authed screen
reads `/me/bootstrap` through the shared hooks, so one screen proves the
keychain session, the injected token, the package under Metro, and the phone's
route to the API all at once.

Two things above turned out to be wrong, both in the direction of less work:

- **Magic links are not the sharp edge — they are not in the product.** The web
  app signs in with **email and password** (`login-page.tsx`), and the only
  magic link sent anywhere is a Supabase *invite*, whose redirect
  `SupabaseAdminService` hardcodes to `WEB_URL/auth/callback`. Mobile therefore
  has password sign-in, and an invited bandmate accepts on the web, sets a
  password, and signs in here with it. Items 1–3 of the list above (custom
  scheme, allow-list, `expo-auth-session`) are **not built**: the `scheme` is
  declared in `app.json` because P13 needs it for a notification tap, but
  nothing consumes it yet. A mobile-native invite flow would need the API to
  know which channel a person is accepting on — that is a feature, not plumbing,
  and no phase owns it.
- **No dev client is needed yet.** Every native module here ships inside Expo
  Go, so verification is a QR code. That holds until P13: `expo-notifications`
  cannot receive remote push in Expo Go, so the dev client moves there.

The JWT path needed no changes, which was worth confirming rather than
assuming: `SupabaseJwtStrategy` checks `audience` but not `issuer`, so a token
minted through the LAN URL verifies against JWKS fetched over `127.0.0.1` —
same GoTrue instance, same keys. CORS is a non-issue too; React Native's
`fetch` sends no `Origin`.

#### Four things that were not going to be guessed right

- **`expo-secure-store` caps a value at 2048 bytes** (Android's KeyStore) and a
  Supabase session is a few kilobytes of JSON carrying two JWTs. The documented
  `storage: SecureStore` wiring works right up until a token grows, then fails
  as a mysterious "signed out on relaunch". `src/lib/chunked-store.ts` splits
  values across `key.0`, `key.1`, … with a manifest at `key` recording the part
  count **and** the total length. The length is the load-bearing half: without
  it, an app killed between writing part 0 and the manifest would splice a
  fresh first part onto a stale second one and hand Supabase a plausible but
  corrupt session. Splitting is on code-point boundaries measured in **UTF-8
  bytes** — `string.length` counts UTF-16 units and can cut a surrogate pair in
  half. The backend is injected, so all of it is unit-tested without a device.
- **`resolver.disableHierarchicalLookup` is wrong in an npm workspace**, even
  though Expo's monorepo guide suggests it. npm hoists what it can and nests
  what it cannot: `expo-router` itself lands in `apps/mobile/node_modules` with
  `@expo/metro-runtime` nested beneath it. Switching off the walk-up made that
  unresolvable — "Unable to resolve module" for a package that is plainly
  installed. The setting belongs to pnpm-style isolated installs.
- **Two copies of React, which is the real monorepo trap.** The SDK pins
  `19.2.3`, `apps/web` pins `19.2.4`, so npm installed both — and app code
  would have resolved the nested one while `packages/api-client` resolved the
  hoisted one. Hooks from the shared package and the component tree rendering
  them would have come from different React instances: an "Invalid hook call"
  with a long fuse, invisible to every check that passes here. Pinned to web's
  `19.2.4`, which sits inside React Native 0.86's `^19.2.3` peer range, so one
  copy serves everything.
- **`expo-linking` had to be declared** although it resolves fine from the root.
  It is a non-optional peer of `expo-router`, and **autolinking reads
  `package.json`, not the resolver** — so a native build would have shipped
  without the module while the bundle looked healthy.

Known gaps, deliberate: the notifier is an `Alert` for errors and silence for
successes (a toast is a design-system component, so P6 owns it), and
`src/theme.ts` is a placeholder palette, not tokens.

### P6 — Primitives + design tokens

Build the token layer and base components in `StyleSheet`: `Card`, `Text`,
`Badge`, `Sheet`, `Skeleton`, tab bar, header.

Tokens consume `packages/shared/src/theme.ts` and `resolveBoardTheme()`, the
same source the web app uses for per-board palettes — so a board's colours are
identical on both platforms, and board colour-coding in P9 comes free.

**Correction from P5:** that is more work than this says.
`packages/shared/src/theme.ts` holds palette *metadata* — ids, labels, and
which slots a palette fills — and says so in its own comment: "Deliberately
holds no color values: the actual colors live in `globals.css` under
`[data-palette="<id>"]`". Metro cannot read CSS. Matching palettes across
platforms means **lifting those values out of `apps/web/src/app/globals.css`
into `packages/shared` first**, with web reading them from there too, or the two
platforms will drift the first time a colour is tweaked. Until that lands,
`apps/mobile/src/theme.ts` is a neutral placeholder with no board palette in
it.

Use the `expo-design-system` skill: it explicitly covers auditing for
hardcoded colours/spacing/fonts and the "looks AI-generated instead of native"
tells. `expo-native-ui` covers HIG semantics, safe areas, and responsive
layout.

**Built.** Two commits: the shared colour source, then the mobile layer on top.
43 new units (29 in `packages/shared`, which gained a test runner; 86 new
assertions in web's suite). Both screens are now free of hardcoded colour.

#### The palette lift, and why `apps/web` was left alone

`packages/shared/src/palettes.ts` now holds five palettes × four slots × two
schemes, the brand accents `playful` is built from, and the eighteen surface
tokens both platforms name identically. `slotTokens()` carries the
coloured-card formula.

`apps/web` still renders from `globals.css`. Generating that stylesheet from the
package was the plan, and it was the wrong trade for a mobile phase: it means
rewriting 300 lines of hand-tuned CSS and needing eyes on the result.
`apps/web/src/app/palette-tokens.test.ts` parses the stylesheet and checks it
against the package declaration for declaration instead — which is also how the
transcription was verified in the first place. Mutation-tested three ways: a
nudged value in the package fails, the same nudge in the CSS fails, and a new
`[data-wc]` override the package does not mirror fails. That last case is the
quiet one, since otherwise it would surface only as a card that looks different
on a phone. Generating the CSS is now a safe follow-up whenever the duplication
grates, because the test pins the current output exactly.

#### Two things that had to be solved rather than configured

- **React Native cannot parse `oklch()`.** `@react-native/normalize-colors`
  takes hex, `rgb()`, `hsl()`, `hwb()` and names. An OKLCH string does not
  throw — it silently yields no colour, which is the worst kind of failure. So
  `packages/shared/src/colors.ts` converts, pinned against the published sRGB
  primaries rather than its own output, and emits the 8-digit `#rrggbbaa` form
  RN reads for the translucent tokens. Three authored colours turn out to sit
  outside sRGB (ocean's c2 in both schemes, playful's dark c3 foreground) and
  are gamut-mapped by reducing chroma at constant lightness and hue, the way
  CSS Color 4 specifies — so both platforms land in the same place. Worth being
  accurate: for those three it barely matters (`#00828d` clipped vs `#00818c`
  mapped). The reason to do it properly is the colour nobody has authored yet,
  where clipping shifts the hue.
- **There is no cascade.** The whole colour system leans on one: a coloured card
  re-points thirteen tokens and everything inside inherits them. Threading
  colours through every child would put back exactly the per-widget styling the
  CSS formula removed, so `Card` publishes its token set through React context
  and the text, badge and button primitives read the nearest one. Outside a card
  that is the page's own tokens.

#### Deviations from this phase's component list

All three are toward native chrome, following the skill's named slop tells:

| Planned | Built | Why |
|---|---|---|
| `Sheet` | nothing | A custom sheet is "The Web Modal". The native answer is a route with `presentation: "formSheet"` — configuration in P8, not a primitive. |
| tab bar, header | nothing | `NativeTabs` and the stack header already carry the platform's design language; the skill is explicit about not wrapping platform components to route them through the system. P7 configures them. |
| — | `TextField`, `Button` | Sign-in had hand-rolled both and home needed the second button. Two screens is the extraction trigger. |

`Card`, `ThemedText`, `Badge` and `Skeleton` were built as planned.

Also deliberate: the skill's default is a palette built from platform semantic
colours, with brand pairs only where the brand needs them. Here that exception
is the whole surface — a warm cream canvas and five board palettes that have to
match the browser. `systemBackground` would be a different app. The system font
*is* kept, so text renders in San Francisco or Roboto rather than matching the
web app's typeface; the native face is worth more than the match.

#### Found for P7

`BoardSummaryDto` carries id, name, membershipId and role, and deliberately no
theme — "listing twenty bands should not fetch twenty themes" (P3). So **the
board switcher cannot colour-code the boards it lists**, which the hub design
implies it would. Either widen the DTO with just the palette id, or accept a
neutral list. The home screen currently paints its band list in the *current*
board's palette and rotates the slot per row.

### P7 — Board hub (stat cards)

The hub is one board's widgets as **summaries**, not full content. Tapping one
opens its spoke.

```
┌─────────────────────────────┐
│  Neon Harbor        ▾    ⋯  │   ▾ = board switcher (bottom sheet)
│  ───────────────────────    │   ⋯ = manage widgets, board settings, archive
│  ╔═══════════════════════╗  │
│  ║ ⚡ FOCUS              ║  │   hero card — prose, full width
│  ║ Finish the EP mix     ║  │
│  ╚═══════════════════════╝  │
│  ┌──────────┐ ┌──────────┐  │
│  │ ☑ To-Do's│ │ ◉ My Tasks│ │   stat cards — countable, half width
│  │    12    │ │     5     │ │
│  │ 3 today  │ │ 2 this wk │ │
│  └──────────┘ └──────────┘  │
├─────────────────────────────┤
│  ▣      ▦      ◉       ◍   │
│ Board Calendar Inbox  You   │
└─────────────────────────────┘
```

**The stat grid is the widget index.** No tab strip on the hub: a 10-item
horizontal scroller is poor readability — you cannot see what is available, you
discover it by scrolling blind. The grid already shows every widget with its
numbers, which is a better index than tabs could be.

**The board switcher is the header title, not a tab.** Mixing a mode switch
into a content tab strip breaks what a tab strip teaches, and the rightmost
item of a scrolling strip is both hardest to reach and first to disappear.
Tapping the board name is the Slack/Notion/Linear convention and needs no
teaching. You land in your last-opened board; the board list is only a launch
screen when you have zero boards or have never picked one.

**Card anatomy** — fixed so ten widgets read as one system: icon + title / one
primary value / one qualifier line / optional urgency accent.

| Widget | Primary | Qualifier | Card |
|---|---|---|---|
| Focus | the focus text | period | hero |
| Notes (`CUSTOM`) | first line of the note | — | hero |
| To-Do's | open count | `N due today` | stat |
| My Tasks | assigned count | `N this week` | stat |
| Goals | active count | `N% complete` | stat |
| Shows | next date | venue | stat |
| Next Rehearsals | next date | `N upcoming` | stat |
| Next Meetings | next date | `N upcoming` | stat |
| Reminders | `N due` | next due date | stat |
| Activity | `N new` | since last visit | stat |

Two prose widgets get hero cards, eight countable ones get stat cards. That
split gives the grid a rhythm instead of a uniform wall of numbers.

This is **new UI, not a port** — no existing `Collapsed` variant renders as a
stat.

**Built.** Three commits: the shared widget metadata, the tab navigation, then
the cards. 19 new units (mobile's suite is now 32).

#### What the design got right, and the one thing it could not

The grid-as-index, the header-as-switcher and the fixed card anatomy all came
through as designed. The numbers were matched to what the web widgets already
mean rather than invented — root tasks only for To-Do's, the caller's own id
for My Tasks, the completed share of live goals for the percentage, and one
event factory over three `Event.type`s.

**Activity cannot show "N new since your last visit."** That needs a
per-device last-seen marker nothing writes, and opening the hub would zero it
immediately. The card counts today's entries and dates the newest instead,
which says something true with no hidden state. The unread version belongs with
the Inbox in P9, where "unread" has to be defined anyway.

#### Navigation shape

`(tabs)/(index,calendar,inbox,you)/` is **one stack definition instantiated four
times**. That is for P8: a task opened from the board, the calendar or the inbox
is written once and pushes onto whichever stack the person is in, instead of
yanking them to another tab.

Both the switcher and the `⋯` are native `formSheet` routes. On iOS a
`Stack.Toolbar.Menu` would be more idiomatic for three actions, but it is
iOS-only, and one implementation both platforms get beats the perfect menu on
half of them — the same reasoning that kept `@expo/ui` out.

The selected board is persisted in AsyncStorage, because "you land in your
last-opened board" does not survive a process otherwise. The stored id is
**re-validated against live membership on every load**: someone removed from a
band keeps the id on their phone, and trusting it would leave the app asking
for a board the API will refuse.

#### `BoardSummaryDto` still has no theme

Flagged at the end of P6, and it stayed true: the switcher lists bands by name
and role with no colour of their own. Rather than widen the DTO, `useBoard`
moved into `@artist/api-client` (keeping web's `["board", boardId]` key exactly
— several web mutations invalidate it directly) and the hub reads the selected
board's palette from it. Colour-coding the *list* is still unavailable, and is
only worth doing if the switcher grows past a handful of bands.

#### `npm run mobile` was broken from P5 until here

`expo start` crashed on startup: typed-route generation runs inside `@expo/cli`,
which npm installs under the repo root, and it `require`s
`expo-router/_ctx-shared` — which npm nests in `apps/mobile/node_modules` over
a `react-is` conflict with the root's test tooling, so Node walking up from the
CLI never reaches it. **P5 only ever ran `expo export`**, which does not touch
that path, so the command P5's own instructions told you to run had never been
run. `experiments.typedRoutes` is now off, which is what triggers it.

Cost: `<Link href>` strings are no longer checked against the route tree, so a
typo is a dead tap rather than a compile error. An `overrides` entry was tried
first and did not move the hoist. Lesson for the remaining phases: **bundling is
not running.** `expo export` proves resolution and types; only `expo start`
proves the toolchain.

### P8 — Spokes (expanded widgets)

Port the existing `Expanded` components from the widget registry. The registry
already defines `Collapsed` and `Expanded` for all ten widget types, so the
hub/spoke split matches the code's existing shape.

The tab strip lives **here**, not on the hub — once you have context, lateral
movement is useful. Swipe between widgets, with a strip showing position
(Photos' grid → tap → swipe pattern).

Routes must be addressable for P13 deep links: `/board/[boardId]`,
`/board/[boardId]/w/[widgetType]`, `/board/[boardId]/task/[taskId]`.

**Built.** Two commits: the shared activity sentence, then the spokes. All nine
card widgets expanded, plus a task detail screen. Read-only throughout — P10 is
write parity and P11 is the note's editor, which is why `CUSTOM` renders text.

`/board/[boardId]` was **not** built. It would be a second route rendering the
hub, which already lives at `/` off the selected board; a deep link to a board
root can set the selection and go there. The other two exist as specified, and
both params are validated, since both come from a URL.

#### The strip, and why it is here

Labels rather than dots: ten dots say how far along you are but not what you
would land on. The strip scrolls to keep the active chip visible — without
that, swiping to the eighth widget leaves it showing the first four and the
position indicator stops indicating. `useVisibleWidgets` is shared with the hub
because the two have to agree: paging past the end of one while the other shows
nine cards is a confusing kind of wrong.

#### Three rules the spokes follow

- **Grouped rows, hairline separators — not a card each.** "Everything's a
  Card" is a named native-slop tell, and a list of twelve tasks is exactly
  where it shows up.
- **Colour reinforces, never carries.** A task row has a status dot *and* the
  status name in its meta line, so it reads the same to someone who cannot
  separate the hues. The same rule P9 applies to board colours.
- **The activity spoke owns its own `FlatList`** instead of the shared
  `SpokeList`. It is the one spoke that can run to hundreds of rows, so it
  needs virtualisation and `onEndReached`, and a list inside a scroll view
  breaks both.

#### The activity sentence moved to `packages/shared`

A feed row's text is built entirely from its denormalised `meta`, so it is
platform-agnostic by construction — and two platforms describing the same event
differently is a bug nobody would think to look for. The icon table stays
per-platform. It also gained the tests it never had, including one that pins
that no *known* activity type falls through to the "did something" fallback:
that line is for a row written by a newer build, not for one this build forgot.

### P9 — Calendar + Inbox screens

Both aggregate across boards, with a board filter.

```
┌─────────────────────────────┐   ┌─────────────────────────────┐
│  Calendar              ⋯    │   │  Inbox          Clear all   │
│  ●All ○Neon Harbor ○Duo ›   │   │  ●All ○Neon Harbor ○Duo ›   │
│  ─── Mar 14 ─────────────   │   │  ● Dana mentioned you       │
│  ● Bowery Ballroom          │   │    Neon Harbor · Mix notes  │
│    Neon Harbor · Show       │   │  ● Sam mentioned you        │
│  ● Load-in 5pm              │   │    Weekend Duo · Setlist    │
│    Weekend Duo · Reminder   │   │                             │
└─────────────────────────────┘   └─────────────────────────────┘
```

Three readability rules:

1. **The filter row hides itself entirely in a single-board account.** Most
   users are — bootstrap creates exactly one board. A one-option filter is
   noise that nearly everyone would see.
2. **Every cross-board item names its board in a subtitle.** A colour dot alone
   is unlearnable, and "Load-in 5pm" is ambiguous without it. Colour reinforces,
   never carries — which also keeps it accessible.
3. **Board scope is sticky per tab, not global.** Filtering Calendar to one
   band must not silently filter the Inbox. They are separate reading tasks.

Board colours come from `resolveBoardTheme()` via the P6 tokens.

### P10 — Write parity

Todos drag-reorder (`react-native-reanimated` /
`react-native-draggable-flatlist`, replacing `@dnd-kit`, which is used in
exactly one file), task status changes, comments with `@` mentions, and
attachments from camera or photo roll against the private `attachments` bucket.

Permissions come from the shared `can()` map — never a hardcoded role check.
Reorder in particular is ADMIN-gated on web to match the endpoint's
`@BoardRoles('ADMIN')`; mobile must match.

### P11 — Notes widget

`@tiptap` has no React Native port. Use **`@10play/tentap-editor`**, a real RN
bridge to the same ProseMirror/Tiptap core, so the stored document JSON stays
compatible with what web reads and writes. Needs a mobile toolbar.

Medium risk and deliberately late — nothing else depends on it.

### P12 — Mobile layout editor

Reorder widgets and show/hide them, writing the same `LayoutItem[]` the API
already stores, so a layout edited on either device stays valid.

**Recommendation: do not port the 12-column drag-resize grid.** A phone has no
12 usable columns. Offer reorder plus show/hide, with width snapping to
full-bleed or half. That is parity of *capability* without pretending. The
layout maths in `packages/shared/src/layout.ts` (`mergeLayouts`,
`DEFAULT_BOARD_LAYOUT`) is reusable verbatim either way.

Highest UI risk in the project — `react-grid-layout` has no RN equivalent, so
whatever this becomes is custom `reanimated` + `gesture-handler` work.

### P13 — Push client

Register device tokens against P2's `DeviceToken`, request permissions at a
sensible moment (not cold on first launch), and **deep-link a notification tap
to the right spoke or entity** using P8's addressable routes.

No skill exists for this. Expo docs only.

### P14 — Store builds

EAS Build, icons, splash, app store metadata, TestFlight and Play internal
track. `eas-update` gives OTA JS updates without a store review — a genuine
advantage over the current web deploy story. `eas-workflows` when builds should
run in CI.

**Hosting prerequisite, inherited from email notifications:** the dispatcher
and reminder job are in-process `@Interval`s and will never fire on a
serverless host that sleeps. The API must be on a long-running host
(Railway/Render/Fly, **not** Vercel), and a phone needs to reach it over the
network — `NEXT_PUBLIC_API_URL` currently points at `localhost:3001`. Required
for P5 on-device testing, not just for release.

### P15 — Web board switcher

Close the deferred consequence of P3's additive approach: teach `apps/web` to
show all of a user's boards instead of silently using the first. Its own phase
so it is a deliberate feature rather than collateral damage from mobile work.

## Library replacement reference

| Web | Mobile | Risk |
|---|---|---|
| shadcn/ui + Tailwind + `@base-ui/react` | `StyleSheet` primitives + shared theme tokens | Low — 23 small `components/ui` files |
| `react-grid-layout` (dashboard grid) | Custom `reanimated` + `gesture-handler`; layout maths reused from `packages/shared` | **High** |
| `@dnd-kit` (todos reorder only) | `reanimated` drag list / `draggable-flatlist` | Low — one file |
| `@tiptap` (notes widget) | `@10play/tentap-editor` — same ProseMirror core | Medium |
| `next/navigation`, `next/link` | `expo-router` — maps near 1:1 onto the 4 routes | Low |
| `next/font`, `next-themes` | `expo-font`, theme context over shared tokens | Low |
| `@supabase/supabase-js` on `localStorage` | same, with `expo-secure-store` storage adapter | Medium — see P5 |

## Risk register

| Risk | Phase | Mitigation |
|---|---|---|
| Cross-board query leaks another band's data | P4 | One `@UserBoards()` decorator; explicit non-member leak tests |
| Magic-link deep link silently fails | P5 | Allow-list both schemes; verify on hardware before anything else is built |
| No skill coverage for push or secure-store | P5, P13 | Expo docs; extra on-device verification time |
| Metro cannot resolve `packages/shared` TS source | P5 | `monorepoRoot` watch folders; expect to hit this first |
| Drag-resize grid has no RN equivalent | P12 | Scope to reorder + show/hide; reuse shared layout maths |
| API unreachable from a device / jobs don't fire | P14 (needed by P5) | Long-running host, not serverless; real `API_URL` |
| P1's 26-file refactor regresses web silently | P1 | Behaviour-neutral by definition; web Jest suite is the gate |
