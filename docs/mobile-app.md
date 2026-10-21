# Mobile App (React Native + Expo)

> **Status:** in progress. P0–P4 done and verified; **P5–P9 built, awaiting
> verification on a phone** — `apps/mobile/` signs in, has its four tabs, every
> widget reads end to end (hub card → spoke → task), and the Calendar and Inbox
> span every band you are in. Nothing writes yet. P10 (write parity) is next.
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
| **P5** | [Expo skeleton + auth on a real device](#p5--expo-skeleton--auth-on-a-real-device) | mobile | ☑ |
| **P6** | [Primitives + design tokens](#p6--primitives--design-tokens) | mobile, **shared** | ☑ |
| **P7** | [Board hub (stat cards)](#p7--board-hub-stat-cards) | mobile, **shared** | ☑ |
| **P8** | [Spokes (expanded widgets)](#p8--spokes-expanded-widgets) | mobile, **shared** | ☑ |
| **P9** | [Calendar + Inbox screens](#p9--calendar--inbox-screens) | mobile, api | ☑ |
| **P10** | [Write parity](#p10--write-parity) | mobile, **shared**, web | ☑ |
| **P10b** | [Content editing](#p10b--content-editing) | mobile, shared, api-client | ☑ |
| **P10c** | [Board admin](#p10c--board-admin) | mobile, api-client, web | ☑ |
| **P11** | [Notes widget](#p11--notes-widget) | mobile, shared | ☑ |
| **P12** | [Mobile layout editor](#p12--mobile-layout-editor) | mobile, shared | ☑ |
| **P12b** | [Phone arrangement](#p12b--phone-arrangement) | mobile, shared, api, api-client | ☑ |
| **P12c** | [Polish](#p12c--polish) | mobile (mostly) | ☑ |
| **P13** | [Push client](#p13--push-client) | mobile, api, api-client | ☑ |
| **P14** | [Store builds](#p14--store-builds) | mobile, CI | ☐ |
| **P15** | [Web board switcher](#p15--web-board-switcher) | **web** | ◐ |
| **P16** | [Notes-style editor](#p16--notes-style-editor) — **dropped**, replaced by titled notes | api, shared, web, mobile | ◐ |
| **P17** | [Redesign](#p17--redesign) | mobile, api-client | ☑ |
| **P18** | [Join links](#p18--join-links) | api, shared, mobile, web | ☐ |

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

**Built.** Three commits: the board palette, the shared day rule, then the two
screens. All three readability rules above hold as written. One API change and
one shared-logic lift were needed first, both below.

#### The calendar is an agenda, not a month grid

Web draws 42 cells with chips in them. At 390pt a cell is 50pt wide, and
"Bowery Ballroom" does not fit in 50pt — a phone month grid can show *that*
something is on the 14th and never *what*. The same month read as a list of days
loses nothing a phone could have displayed anyway, and gains the time, the band
and the status on every row.

It stays bounded to one month rather than scrolling endlessly in both
directions, because the request has to have an end — the API caps a range at 370
days — and because "what is in March" is the question a month stepper answers in
one tap. Days with nothing in them are left out: a grid must draw empty cells to
keep its shape, but a list that printed 19 empty headings would bury the five
days that matter.

#### `BoardSummaryDto` gained a palette, which was P6's recorded gap

P6 noted that `BoardSummaryDto` carries no theme, so the switcher could not
colour-code the bands it lists. P9 needs the same thing twice over — a filter
chip per band, and a dot per row — so the field landed here: **just
`palette`**, one enum member off the board row the query already joins. The
expensive half (`widgets`) stays behind `GET /boards/:id`, so the "listing twenty
bands must not fetch twenty themes" rule the DTO's comment states is intact.

Two endpoints answer "which bands am I in" — `GET /boards` and the `boards`
array on `GET /me/bootstrap` — and they built that object independently. Adding
the field to one would have coloured the switcher and left the filter row grey,
with nothing failing to say so. They share a mapper now.

A **band's colour is not on the calendar item.** The response already carries
`boardId` and `boardName`, because a merged item is otherwise unidentifiable and
unlinkable — but a palette is per board, not per item, and the board list is
already loaded and already says it. Putting it on every row would repeat one
fact a hundred times and create a second place for it to go stale.

#### Which day an item falls on is now shared, and the test needed a timezone

`calendarCategory` and the day-bucketing rule moved to
`packages/shared/src/calendar.ts`, joining `activityText` and `WIDGET_META`. The
bucketing is the load-bearing one: an event happens at an **instant** and belongs
on the local day that instant falls in, while a task's due date is a **calendar
day** stored as UTC midnight that must not be read locally at all. Web had this
right, in one private function — exactly the shape that gets reimplemented
slightly differently next door, where the symptom is a deadline off by a day.

The shared suite now runs in `America/Los_Angeles`. In UTC the two readings
agree, so with the distinction deleted **all twelve of these tests pass in UTC
and four fail in LA** — a suite that only ran in UTC would have been decoration.
Switching zones inside a test does not work: Jest hands tests a *copy* of
`process.env`, so assigning `TZ` never reaches the `tzset` that `Date` reads, and
the assertion silently checks the host's zone instead of the named one. Pinning
it in the test script is what works.

#### "Unread" got its definition, and the activity feed does not get one

P7 deferred Activity's "N new since last visit" to here, on the grounds that
P9 had to define "unread" anyway. It did, and the answer rules the feed out: a
**mention is a row that exists until it is dismissed**, so a count of them is a
fact, needing no per-device marker and no guess about what has been looked at.
That is why the Inbox gets a tab badge. An activity feed is a log of what
happened, not a list addressed to anyone, so the same badge there would need a
last-seen marker per device to mean anything — and would then claim things are
"new" that the person has already seen on web. Left unbuilt deliberately, not
deferred again.

#### Smaller decisions worth not relitigating

- **The filter is sticky per tab, and re-validated against live membership.** A
  stored id outlives the membership it refers to; sending it anyway asks the
  server to intersect by a board it will reduce to nothing, giving a silently,
  permanently empty list. An unknown id reads as "All".
- **`Stack.Toolbar` was not used** for "Clear all", despite being the native
  idiom the `expo-router` skill leads with: it is iOS-only (SDK 55+), and this
  app ships Android. `headerRight` is the cross-platform half.
- **No category filter**, although web has one. The plan specifies a band filter
  for this phase, and two filter rows above a list on a phone is one too many.
- **The lead slot shows whichever of band or kind is doing work** — the band's
  dot with several bands on screen, the kind's icon with one, since in a
  single-band account the band carries no information. The kind is named in the
  meta line either way, so nothing is carried by colour.
- **`ListState`** joins `SpokeList`: the same loading/failed/empty states for
  screens that own a virtualised list, which cannot live inside `SpokeList`'s
  scroll view.
- The placeholder tab screen is deleted — all four tabs are real.

#### Found in verification: the badge has to be a direct child

The first Inbox badge never appeared. It lived in an `InboxBadge` component that
returned `Trigger.Badge`, or `null` at zero — but `NativeTabs` reads its
triggers' children as configuration, not as rendered output, and recognises a
`Badge` only as a **direct** child of the `Trigger`. A wrapper is silently
dropped. The count now comes from a hook in the component that renders the
whole tab bar, and the `Badge` is always mounted, `hidden` at zero. Keep
`Trigger.Icon` and `Trigger.Label` as direct children for the same reason.

### P10 — Write parity

Todos drag-reorder (`react-native-reanimated` /
`react-native-draggable-flatlist`, replacing `@dnd-kit`, which is used in
exactly one file), task status changes, comments with `@` mentions, and
attachments from camera or photo roll against the private `attachments` bucket.

Permissions come from the shared `can()` map — never a hardcoded role check.
Reorder in particular is ADMIN-gated on web to match the endpoint's
`@BoardRoles('ADMIN')`; mobile must match.

**Built.** Four commits: two lifts into the shared packages, then status and
checklist, comments and attachments, and reorder. Plus checklist ticking, which
the list above omits but the task screen already drew as checkboxes — a box
that looks tickable and is not would be worse than no box.

#### Permissions answer for the route's board, not the selected one

The tab chrome mounts `PermissionsProvider` with the *selected* board's role.
While every screen only read, that was harmless. A task opened from the Calendar
or the Inbox can belong to another band, where the person's role differs —
admin of their own project, a member of a friend's. Every screen under
`/board/:boardId/…` now wraps itself in `BoardPermissions`, which takes the role
from `me.boards` for the board in the path. Not a member (removed since the
link was made) reads as `USER`; the API's 404 does the rest.

#### Two more things lifted, for the usual reason

- **Mention parsing** moved from `apps/web` to `packages/shared/src/mentions.ts`
  (with its test). Which names count as a mention decides who gets an inbox
  row, and "@sam.jones" parsed two ways would notify the wrong person with
  nothing failing.
- **The upload flow** moved to `@artist/api-client` (`useAttachments`,
  `useUploadAttachment`, `useDeleteAttachment`, `uploadAttachment`,
  `fetchAttachmentUrl`). Only the PUT differs by platform, so the caller
  supplies it as `UploadSource.put`: web wraps a `File` (`fromFile`), mobile
  hands the URI to `expo-file-system`'s native `File.upload` so a 40MB video
  never crosses into JS. The size cap, the signed URL and the board-prefixed
  path now exist once.

Two api-client fixes fell out of it. Deleting a comment's file now refreshes the
comment, which carries its attachments inline (web had shown it until the next
refetch). And `useUpdateTask` refreshed only the *parent* when a subtask
changed — enough for web, which edits subtasks inside the parent's modal, but
on mobile a subtask is its own screen and stayed stale.

Task mutations now return their refetch from `onSuccess`, so a mutation stays
pending until fresh data has landed. That is what lets a checklist tick (and a
drag) render the pending value without flickering back between "saved" and
"refetched".

#### Storage signs URLs a phone cannot reach

The API signs upload and view URLs with *its* `SUPABASE_URL`, which in local
development is `127.0.0.1:54321` — the phone itself, from the phone. The
signature is a query-string token, not bound to the host, so
`lib/storage-url.ts` swaps a loopback origin for the LAN one the app already
uses for Supabase. Public origins are left alone, so a deployed API needs
nothing. It is string surgery rather than `URL` setters, which React Native's
`URL` does not reliably implement; the first draft's test also caught that
setting `host` without a port keeps the old one.

#### The interaction choices

- **Status is a native `formSheet`** at `/board/:boardId/status/:taskId`,
  opened from task detail's status pill or a todo row's dot. Statuses are the
  board's own — any number, each with a colour — and a list is the one control
  that shows all of that on both platforms. It closes once the change has been
  refetched, so the screen underneath is already right.
- **Mention suggestions are chips above the field**, not a floating popup: a
  popup over a scroll view covers the text being typed, and the keyboard's own
  suggestion bar already taught the chip row.
- **Attachments are three buttons — Camera, Photos, Files** — not one "Attach"
  behind a menu. Android's alert holds three buttons, one short of three sources
  plus cancel. Camera is stills only (video would add a microphone prompt);
  photos are re-encoded to JPEG because a bandmate opening an iPhone HEIC on web
  sees nothing.
- **Files open in the system browser sheet** (`expo-web-browser` — Safari View
  Controller / Custom Tabs, not an embedded webview). It renders images, PDFs,
  audio and video, and its share button covers saving, so it replaces web's
  separate view and download buttons.
- **Reorder is hold-then-drag** with `react-native-reorderable-list` (pure
  gesture-handler + Reanimated, maintained; `draggable-flatlist` has not shipped
  since May 2025). The pan activates only after the long press, so swiping to the
  next widget still pages. Screen readers get Move up / Move down actions.
  ADMIN-only via `task.editFields`, matching `@BoardRoles('ADMIN')`.

#### Found along the way

- **The Todos spoke was in the wrong order since P8.** It never passed a sort,
  so it showed the API default — newest first — while web's To-Do widget shows
  the board's manual order. Reordering a list that ignores the order would have
  been meaningless; it now asks for `sort: 'order'`.
- **There was no `GestureHandlerRootView`.** Only expo-router's JS stack
  supplies one; this app uses the native stack. Gesture Handler without its root
  does nothing and reports nothing — the drag would simply never have picked up.
- **Android keyboard:** edge-to-edge means the window no longer resizes for the
  keyboard, so task detail wraps in a `KeyboardAvoidingView` on Android only;
  iOS's scroll view insets itself (`automaticallyAdjustKeyboardInsets`).

#### Pointed here by earlier phases, and not built

P7's board menu labels **Archive** and **Board settings** as P10, and P9 deferred
**creating and editing events, reminders and goals** to P10. None is in the list
above, and none was built; nor were the task's own fields (title, description,
priority, due date, assignees), new tasks or subtasks — admin work that stays on
web for now. Where they belong is an open decision, not a silent drop.

### P10b — Content editing

Decided after P10's verification: the work earlier phases had pointed at P10
becomes two more gated phases before P11, because a phone that cannot add a
show or fix a typo still sends its owner to web for half of what they open it
for. Content first — it is what people do every day; settings are mostly done
once.

- **Tasks:** edit title, description, priority, due date and assignees; create
  tasks and subtasks; delete. Admin-gated by the shared map exactly as web is
  (`task.editFields`, `task.create`, `task.createSubtask`, `task.delete`).
- **Events, reminders, goals:** create, edit, delete; complete a goal, tick a
  reminder done (`event.manage`, `reminder.manage`, `goal.manage`).
- **Focus:** set or clear the week's and the year's focus (`focus.manage`).
- **Archive / unarchive** an item from its edit form (`item.archive`), with the
  same "also take the N linked tasks" choice web offers, never on by default.

One form route, `/board/:boardId/form/:kind`, create and edit, presented as a
modal with Cancel and Save. Entry points: a **+** in each spoke's header, **Edit**
on task detail, **Add subtask**, and tapping an event, reminder or goal row.

**The date trap, again.** A task's or goal's due date is a calendar day stored
as UTC midnight. Web gets that for free — `new Date("2026-10-02")` parses a
date-only string as UTC — but a native picker returns a *local* `Date`, and its
`toISOString()` lands on the wrong day west of UTC. The write side of P9's rule
is in `packages/shared/src/calendar.ts` (`dueDateFromLocalDay`,
`localDayFromDueDate`), tested in Los Angeles. Events and reminders are instants
and convert normally.

**Built.** Four commits after the plan: a display fix, the api-client
invalidation fix, then the forms.

#### Due dates were a day early on the phone since P7

Writing due dates surfaced the reading bug. The hub, the spokes and task detail
passed a due date straight to `shortDate`/`isToday`, which read an instant in
local time — so in Los Angeles a task due the 2nd showed as the 1st, and "due
today" counted yesterday's. The calendar was right only because P9 had used the
shared rule. `dueDay()` in `features/board/format.ts` adapts a due date for the
instant helpers, and every due-date read goes through it. The mobile suite now
runs in `America/Los_Angeles`, like `packages/shared`'s: in UTC the bug cannot
be seen.

#### Calendars were not refreshed by the writes that change them

Planning mutations invalidated `["calendar", boardId]`, but the phone's
Calendar tab reads `["calendar", "all", …]`, so an event saved on the phone left
that tab stale until its cache aged out. Task mutations invalidated no calendar
at all, though due tasks are on it. All four now invalidate every calendar
query — there are only ever a handful — and return their refetch, so an
optimistic tick holds until fresh data lands, as the task hooks already did.

#### The shape of the forms

- **One route, five forms.** `/board/:boardId/form/:kind` with `?id=` to edit,
  `?parentTaskId=` for a subtask, `?type=` for a new event. One stack entry, one
  frame (`FormScreen`): a modal with Cancel and Save, keyboard-aware.
- **A form mounts only once its data has arrived** (`FormGate`), so it takes the
  item as initial state instead of syncing it in from an effect. The gate also
  answers a stale link: a member landing on an admin's form is told so.
- **PATCHes carry only what changed.** Sending every field would log activity
  for edits nobody made.
- **Unsaved work is guarded by `usePreventRemove`** (from
  `expo-router/react-navigation`), which catches the iOS swipe, Android's back
  button and Cancel alike. Saving, archiving and deleting leave through
  `useLeaveForm`, which skips the prompt.
- **Dates use each platform's own picker** (`@react-native-community/datetimepicker`,
  which ships in Expo Go): the compact inline pill on iOS; on Android, which has
  no inline picker and no date-time mode, the date dialog then the time dialog.
- **Header actions are one pure function** (`spokeAction`), tested against the
  shared map so a member is never offered a form the API would refuse. It
  follows the page you have swiped to. My Tasks offers none: a new task there
  would need self-assignment, an admin's call, and To-Do is one swipe away.
- **Goal labels are web's** (Yearly / Monthly / Daily), and archive/delete copy
  is web's `ItemActions` copy, as alerts. Linked tasks are a separate button,
  never the default — web's unticked checkbox.
- **Subtasks only on root tasks**, as on web (the API allows two levels; web's UI
  offers one, and two clients offering different depths would be a bug report).

#### Still web-only after this phase

Linking a task to a goal or event, and editing checklist item text (ticking is
on mobile since P10). Neither was asked for; both are small if they are wanted.

### P10c — Board admin

The **Archive** screen (browse, restore, delete forever) and **Board settings**:
palette, statuses, members and invites, and the person's notification
preferences. The invites and members queries live inline in web's settings
page, so they move into `@artist/api-client` first.

**Built** (two commits: the lift, then the screens). P10b and P10c go to
verification together — the user skipped P10b's gate once to test both in one
pass.

#### Lifted first, as with every shared write

Members (remove), invites (list, send, revoke), statuses (list, create,
update, delete) and notification preferences (read, optimistic save) lived
inline in web's settings components. They are `@artist/api-client` hooks now
and web uses them, unchanged in behaviour and toasts. Two small gains came with
the move: removing a member refreshes the task lists their assignments vanish
from, and a failed invite revoke reports itself instead of failing silently.
Archive/restore got the same calendar-wide refresh as the planning hooks, and
a palette change now also refreshes `me`, whose per-band palettes colour the
phone's band dots and filter chips.

#### Choices

- **Both screens open from the board menu**, for the selected band, at
  `/board/:boardId/archive` and `/board/:boardId/settings`. Settings is visible to
  every member, because notification preferences are personal; the sections
  inside are gated by the shared map exactly as web gates its cards.
- **The Archive keeps web's additive category chips and drops the year and day
  filters**: two more controls above a usually short list cost more than they
  save on a phone. A task opens its task screen (now marked "archived"),
  everything else opens its form, where Unarchive and the "with its N tasks"
  choice already live — no second restore path to keep in step.
- **Status colours are a fixed set of eight swatches**, the board's four
  defaults plus four, instead of web's colour input; a status's existing colour
  is always offered, so editing never loses one. Deleting a status still in use
  is refused by the API with a count, which the phone shows as is.
- **The palette is here; per-widget card colours are not.** The palette is the
  decision that changes how the board looks; the per-card overrides are kept
  intact when the palette changes on the phone. The default layout is P12's.
- **Invite results are an alert**, because the phone's notifier shows no success
  toasts and whether an email actually went out is worth knowing.

### P11 — Notes widget

~~`@tiptap` has no React Native port. Use **`@10play/tentap-editor`**, a real RN
bridge to the same ProseMirror/Tiptap core, so the stored document JSON stays
compatible with what web reads and writes. Needs a mobile toolbar.~~

**Changed at build time, by decision:** tentap runs ProseMirror inside a
**WebView**, which `apps/mobile/AGENTS.md` rules out — Expo was chosen over a
Capacitor wrapper precisely to avoid one. Asked, the user chose a native
editor over the WebView and over plain-text-only.

**Built.** The note is still stored as the same TipTap JSON; the phone never
writes anything else.

- **Reading** draws the document natively (`features/notes/note-view.tsx`):
  bold as bold, lists as lists, links tappable (http/https only — anyone in the
  band writes the note). Unknown node types render their text.
- **Editing** is a native text field in a small markdown dialect, converted
  both ways by `packages/shared/src/note-markdown.ts`. A toolbar (B, I, S,
  bullets, numbers) places the markers — the pure logic is in
  `features/notes/editing.ts`, tested — so nobody types `**`. Admin-only,
  `widget.manage`, as on web; reached from the Notes spoke's Edit.
- **The safety rule is `isMarkdownEditable`.** A note the dialect cannot carry
  exactly — underline (TipTap v3's StarterKit enables it, markdown has no
  spelling for it), a list inside a quote, a node from an extension web adds
  later — opens read-only with "Edit this one on web". The phone never
  flattens what web wrote.
- **A save checks for a concurrent edit.** The note is last-write-wins on web
  too; the phone refetches before saving and, if someone saved elsewhere since
  it opened, asks before replacing their words.

#### How the converter was made trustworthy

The dialect is this module's own, not CommonMark: both directions live in one
file and only have to agree with each other. Three layers of tests:

1. **Fixtures** for every construct and the escapes a phone user would hit.
2. **A seeded fuzz** of 500 documents over an alphabet that is mostly markup,
   escapes, tabs and URLs, asserting each round-trips (and that most were
   actually editable, so it cannot pass vacuously). Run at 120,000 documents
   across six seeds while building, it found five bugs the fixtures had not:
   bracket-style marker nesting writing `****`, a lone `~` beside a `~~`
   marker, code and links spanning a line break, a backslash at the end of
   code, and an unlinked URL turning into a link.
3. **A web test** (`apps/web/src/features/custom-widget/note-schema.test.ts`)
   loads the phone's output into the real StarterKit schema and round-trips
   documents in the exact shape TipTap stores them, default attributes and all.

Two design rules came out of the fuzzing and are worth not relitigating: markers
are **toggles**, so the serializer writes only the marks that change between
runs; and a marker **opens only before non-space** (markdown's flanking rule),
which is what keeps "5 * 3" typed on a phone literal.

#### Known limits

- The person sees markers while editing; formatting appears once saved.
- The toolbar sits at the top of the form and scrolls away in a long note — a
  keyboard-attached toolbar is iOS-only (`InputAccessoryView`).
- Underline cannot be added from the phone, and a note that has any is
  read-only there.

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

**Built.** Manage widgets in the board menu opens a reorderable list (the same
`react-native-reorderable-list` the Todos spoke uses — the risk this section
predicted did not materialise, because a list is not a grid) with a show/hide
switch per widget. It saves the same **personal** layout web edits, so it moves
your web dashboard too, and nobody else's. Reset to the band's default is there
for everyone; admins can also make an arrangement the band's default.

#### The phone had been ignoring the web arrangement since P7

`GET /layout` returns the merged layout in the *shipped default's* array
order — `mergeLayouts` maps over the default — and the person's arrangement
lives in `x`/`y`. The hub and the spoke pager read the array, so a reorder on
web never reached the phone. (P7's checklist item for exactly this was ticked;
by the code it cannot have followed, so that pass was a coincidence of which
widgets were moved.) `readingOrder` in `packages/shared/src/layout.ts` sorts by
position, top to bottom then left to right, and `useVisibleWidgets` uses it.

#### No width control, on purpose

The plan suggested snapping widths to full or half. But since P7 the hub sizes
cards by **what they hold** (prose full width, counts two-up), not by layout
width, so a width control on the phone would only ever change web — a setting
whose effect you cannot see where you set it. `packInOrder` writes a reorder
back by laying widgets out on the 12-column grid in the new order, keeping
every widget's `w` and `h`: a two-thirds To-Do on web stays two-thirds. Hidden
widgets go last so they cannot leave a gap.

#### Smaller decisions

- The last visible widget cannot be switched off — a board showing nothing reads
  as broken, not as a choice.
- The Calendar entry (a tab, not a widget) is never offered but is kept in the
  saved layout untouched.
- `FormScreen` gained `scrollable={false}` so a reorderable list can be the
  form's scroller instead of nesting inside a ScrollView.

### P12b — Phone arrangement

Raised while verifying P12 (2026-10-05): a phone shows at most two columns, and
web's freeform 12-column grid does not survive being flattened onto it. P12
shared one arrangement between the two, which cut both ways:

- **Web → phone:** side-by-side columns on web interleave by row on the phone,
  in an order nobody chose.
- **Phone → web:** a reorder on the phone rewrote web's grid row by row
  (`packInOrder`), undoing a dashboard someone had arranged with care.

**Decisions (asked, answered):**

- **The phone gets its own arrangement**, an ordered list of cards, each shown
  or hidden. Until the person first saves on the phone, it **follows web**:
  web's reading order, default sizes, web's hidden widgets, exactly as P12
  behaved. The first phone save makes it independent; "Follow my web
  dashboard" makes it follow web again. Neither ever moves the other.
- **No band default for phones.** A member who has not arranged their phone
  follows their own web arrangement, which itself falls back to the band's web
  default. "Make this the band's default" leaves the phone and stays on web.

**Revised the same day, before verification: editing moves onto the hub.**
The first build had a Manage widgets sheet with a Full | Half switch per row.
The user asked instead for **web's widget controls on the hub itself**, on a
two-column grid where a card can be **up to 2×2**. Asked, they chose:

- **Order + auto-fill**, like a phone's home screen, over web's free
  positions: the arrangement stays an ordered list, and `packMobileGrid` flows
  each card into the first free spot it fits. Dragging is reordering, and a
  later small card fills a hole a wide one left. Free positions were declined
  because on two columns they mostly make holes.
- **Edit mode** entered by holding a card or ⋯ → Edit widgets, with Cancel
  and Done in the header, over always-editable cards (which fight scrolling
  and tap-to-open on a touchscreen).
- **Resize by dragging the corner**, as on web, snapping between one and two
  cells each way.
- **A two-row card lists the first few things** behind its number (the next
  shows, the top tasks), like a large phone widget, over the same summary with
  more room.

Outside edit mode a one-column card with nothing beside it for its whole
height is drawn across the row (`stretchLoneCards`), keeping the earlier
no-gaps decision; in edit mode cards show their true size, so what you resize
is what you see.

**Storage.** A `MobileLayout` table (board, user, items), not a column on
`UserLayout`: web's Reset deletes the `UserLayout` row, and would take the
phone's arrangement with it. Widgets the board no longer has drop out of a
saved phone arrangement; widgets shipped after it was saved are added at the
end, in web's order. Both rules live in `packages/shared/src/mobile-layout.ts`
with the grid packing, so the API and the phone cannot disagree. An item is
`{ widgetType, w: 1 | 2, h: 1 | 2, hidden? }`; a stored row that no longer
parses (the first draft's `size: 'full' | 'half'`) is ignored, so that phone
follows web again rather than breaking.

**API.** `GET / PUT / DELETE /boards/:id/mobile-layout`, personal like
`/layout`, open to any member. `GET` returns `{ items, source }`, where
`source` is `web` or `phone`, so the editor can say which it is showing.

**Built** (first draft: `6ceac42` shared, `3303aa2` API + migration,
`01769a6` api-client, `c6b79b7` mobile; revision: `519c44d` grid model + API,
`4593401` move/resize helpers, `0659bcc` hub editor).

- **The editor is `features/board/hub-grid.tsx`.** Cards are absolutely
  positioned and moved by transform. Under a drag, the card follows the finger
  on the UI thread; a `useAnimatedReaction` hit-tests its centre against the
  other cards and reaches React only when the card it is over changes, which
  reorders the list and springs the rest to their new cells. The middle 60% of
  a card is the target, so two cards of different sizes do not swap back and
  forth under a still finger.
- **Gestures are memoised** on what cannot change mid-drag: a gesture rebuilt
  while active is cancelled, and every reorder re-renders every card.
- **The corner handle's gesture lives on the card**, simultaneous with the
  card's drag, which ignores a touch that began on the corner. Otherwise a
  finger held still on the corner for 150 ms would start a move instead.
- **Auto-scroll:** a card held within 96 pt of the top or bottom scrolls the
  hub (`useFrameCallback` + `scrollTo`), clamped to the range the scroll
  events report, since the header and tab bar insets are only known there.
- **Resize preview** is a childless dashed outline whose size animates; the
  card itself only changes size when you let go.
- **The board menu's item is now "Edit widgets"**: it closes the menu and
  raises an event the hub underneath listens for (`features/board/hub-edit.ts`).
  The segmented-control package and the Manage widgets sheet are removed.
- **Screen readers** get the card as one control in edit mode, with Move
  earlier/later, Make wider/narrower, taller/shorter and Hide actions.
- **The card type excludes Calendar** (`CardWidgetType`). The request schema
  already refused it, and Zod infers the narrower type from that refinement,
  so the stored type had to agree.
- **Web layout writes refresh the phone's arrangement** in `api-client`, for a
  phone that is still following web. Across devices, the refetch on focus
  (`f8e3c1d`) does the rest.
- **`packInOrder` is deleted.** It existed only so the phone could write web's
  grid, which the phone no longer does.
- The editor's copy says which mode it is in, and "Follow my web dashboard"
  only appears once there is a phone arrangement to drop.

### P12c — Polish

A UI polish pass before P13 adds more screens, so those get built to the
polished standard. Added 2026-10-06, at the user's request.

The user goes through the app, files each issue as a ticket on a **Trello
board**, and the fixes are implemented from those tickets. Scope is whatever the
tickets say; there is no fixed list up front. Each fix is committed on its own,
naming what the ticket asked for. The phase ends, like every phase, with a hard
stop for the user to check the fixes.

**First pass, 2026-10-07/08** (each ticket's card carries its commit and how
to test it): band filter chips stretched tall, one-band accounts get their
band's chip alone, web's next-show line called later today "Tomorrow"
(`daysFromToday` moved to `packages/shared`), full-width cards could not cross
a row of half cards, the band switcher dropped most taps, done tasks struck
through on web too, completing a goal asks first and **always finishes its
open tasks** (no "goal only" — the user's call), and files on events with a
new phone event screen open to every member (`Attachment.eventId`).

**Second pass, 2026-10-13:** picking a status in the status sheet did
nothing (the sheet-header trap below), so a task could not be marked done on
the phone. And the phone could only *display* a task's goal or event; it now
links them like web: Goal and "Show or event" pickers in the task form
(upcoming events only, plus whatever is already linked), a new goal screen at
`/board/:boardId/goal/:goalId` (open to every member; goal rows go there
instead of the admin-only form), a TASKS section on goal and event screens
with Add, unlink and "Attach an existing task" (`/board/:boardId/attach`, a
pushed screen rather than a sheet because of the same trap). Linking is
`task.editFields`, as on web. Task mutations now also refresh goals and events,
whose `taskCount`/`openTaskCount` the completion prompt quotes.

Then, same day: the calendar's band pills had their names clipped (a band
name's Text box measured shorter than its glyphs; fixed by a fixed
`lineHeight`). **Completing a task now finishes its open subtasks** at any
depth, into the same done status, after a confirm naming how many (phone
status sheet; web's five status pickers via `useTaskStatusChange`), with no
"this task only" option, the same rule as goals. A goal's cascade now reaches
the subtasks of its tasks too, and `openTaskCount` counts them. Tasks carry
`openSubtaskCount` (shared `countOpen` in `apps/api/src/tasks/open-subtasks.ts`).
Calendar rows always show the kind's icon; with several bands the band's colour
is a dot on its corner instead of replacing it.

Traps:

- **A sheet's header is drawn over its content.** A ScrollView with
  `contentInsetAdjustmentBehavior="automatic"` steps below it natively, but
  React Native's own layout never hears of the inset, so every Pressable's
  press area sits a header's height off its row (react-native#43546). The row
  lights up on touch and the release is thrown away as "outside": the band
  switcher switched on perhaps one tap in three. The switcher, board menu
  and status sheet are plain Views padded by `useHeaderHeight()` (a
  ScrollView is inset natively even without the prop). The status sheet was
  the last to move, once picking a status was reported doing nothing — which
  had made a task impossible to mark done on the phone.
- **A blank white app after the Mac changes network** is
  `apps/mobile/.env` pointing at the old LAN address: the startup session
  check hangs rather than failing. Metro picks up an edited `.env` without a
  restart.

### P13 — Push client

Register device tokens against P2's `DeviceToken`, request permissions at a
sensible moment (not cold on first launch), and **deep-link a notification tap
to the right spoke or entity** using P8's addressable routes.

No skill exists for this. Expo docs only.

**Built (2026-10-13), awaiting verification on the phone.**

- **The phone is Band Wall.** The display name, and bundle id
  `com.bandwall.app` (Android package too; the user owns the bandwall
  domain) on the individual Apple team `242S9Y93M9`. It went "Artist
  Dashboard" → "Band Board" → "Band Wall": `com.bandboard.app` turned out to
  be registered to another developer — bundle ids are unique across all of
  Apple, and the only check is trying to register one. Web and email still say
  "Artist Dashboard"; renaming them is a separate ticket. The EAS project
  (`@eltons/artist-dashboard`, id in `app.json`) keeps its slug, which must
  match the project.
- **A development build, built on this Mac**, not EAS cloud:
  `npm run mobile:ios` (= `expo run:ios --device`). `ios/` is generated
  (continuous native generation) and gitignored; `eas.json` exists for
  `eas credentials` and for P14.
- **Never a cold prompt.** iOS asks once per install, so the system prompt
  sits behind a "Turn on" on an Inbox card ("Not now" remembers per phone) and
  on the You tab, which also covers "denied" with Open Settings. Permission is
  a React Query query, so returning from Settings refetches it through the
  existing AppState → focusManager wiring.
- **Registration** (`features/push/push.ts`) runs whenever permission is
  granted, on every launch — idempotent server-side, and it picks up a rotated
  token; `addPushTokenListener` covers rotation mid-session. The project id is
  passed explicitly to `getExpoPushTokenAsync`, as Expo recommends.
- **Sign-out unregisters first**, while the session can still say whose token
  it is, bounded to 3 s so it works offline. A token left behind is cleaned up
  by the next sign-in on that phone, because the API removes every other
  account's row for a token it registers (P2).
- **Taps** (`features/push/push-route.ts`, pure and tested) go by the ids in
  the payload P2 already sends: `taskId` → task, `eventId` → event,
  `reminder-due` → the band's Reminders spoke, else the band's hub. The tapped
  band becomes the selected one, so backing out lands on its own hub. Handled
  through `useLastNotificationResponse`, which also carries the tap that
  launched the app; it waits for the stored band choice to load, since
  selecting earlier would be overwritten by it.
- **Foreground**: shown as a banner (iOS drops it otherwise), and a received
  push refreshes the Inbox so the badge moves without waiting for the poll.
- **API**: `PUSH_IN_DEV=true` lets a local API send real pushes
  (`push-transport.factory.ts`); never honoured under `NODE_ENV=test`.
- **Copy**: band Settings on web and phone now say "Notifications", by email
  and on the phone — the dispatcher already lets an email mute silence push.

Traps:

- **Apple's Program License Agreement blocks signing.** With an updated PLA
  unaccepted, `-allowProvisioningUpdates` fails with "PLA Update available"
  and then "No profiles for …". Only the account holder can accept it, at
  developer.apple.com.
- **Fetching a push token fires the token listener.** `getExpoPushTokenAsync`
  makes iOS report the device token again, so an `addPushTokenListener` that
  re-registered on every event looped — ~50 `POST /me/devices` a second on the
  first device build, starving every other request (a reminder save sat
  spinning). The listener now acts only on a token it has not seen, and
  registrations share one in flight (`token-changes.ts`). ngrok's inspector
  (`127.0.0.1:4047/api/requests/http` under the tunnel) is what showed it.
- **APNs rejects a collapse id over 64 bytes, and Expo's ticket hides it.**
  P2 passed the dedupe key as `collapseId`; a reminder's is 96 characters, so
  Apple refused every one (`InvalidCollapseId`) while Expo's *ticket* said
  "ok" and the row was stamped SENT. The error shows only in the *receipt*
  (`/push/getReceipts`), which nothing reads yet. The key is now hashed
  (`collapseIdFor`, 43 chars). Diagnosed by sending by hand with and without
  the key and reading both receipts. Reading receipts in the dispatcher would
  have surfaced it — worth doing before P14.
- **Signing asks for the keychain once per binary.** The first signed build
  prompts "codesign wants to access key …" for the app and every embedded
  framework; **Always Allow** (with the Mac login password) ends it.
- **A push key is separate from signing.** Xcode's automatic signing gives the
  app the `aps-environment` entitlement; Expo still needs an APNs key
  (`eas credentials -p ios`) to deliver. Without one Expo accepts the send and
  nothing arrives.
- **Mentions and assignments skip the actor**, so testing them needs a second
  account. Reminders go to the whole band and are the solo test.
- The global `eas-cli` could not be upgraded (root-owned files under
  `~/.npm-global`); `npx eas-cli@latest` sidesteps it.

The Notes-style editor that was planned alongside this moved to
[P16](#p16--notes-style-editor), at the end, at the user's request.

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

**Built (2026-10-21), awaiting verification.** `apps/web/src/lib/use-me.ts`
wraps the shared `useMe` so `board` and `membership` describe the band the
person picked (kept in localStorage, shared across tabs; a band they have left
falls back to the first). Web reads only the board's id and name and the
membership's role, so only those are swapped. The header shows a band picker
for anyone in more than one band; a switch goes to the dashboard, since an
open item belongs to the band it was opened in. One-band accounts see the
plain title as before.

### P16 — Notes-style editor

**Dropped 2026-10-20 at the user's request.** Instead of a rich-text editor,
the single description on tasks, events, goals and reminders became a list of
**titled, plain-text notes** (`Note` table, `/boards/:id/notes`, migration
`20261021060000_titled_notes` copies each description into a note called
"Notes" and drops the columns). Web edits them in place in the detail modals;
the phone lists them on the detail screens and edits one at a time in
`/board/:id/form/item-note`. Writing needs the item's own edit permission
(`NOTE_EDIT_ACTION`). The board's **Notes widget is unchanged** (still the
TipTap document with the marker editor on the phone). The original plan below
is kept for the record.


Raised while verifying P11 (2026-10-03): the marker editor (`**bold**` while typing) is too
technical for most of the people this app is for, who expect the Notes app.
React Native's own text field cannot style text as it is typed, and the TipTap
port is a WebView, so a real one needs a native module, which Expo Go cannot
load. The user chose to wait for a development build rather than ship a
fragile pure-JS editor in Expo Go, and then (2026-10-13) to do it last.

- Candidate: **`react-native-enriched`** (Software Mansion). Native input on
  iOS and Android, New Architecture only, reads and writes HTML. Bold, italic,
  strikethrough, underline, bulleted and numbered lists, headings, links.
  Check its React Native compatibility table against the SDK at the time.
- The note stays TipTap JSON. The editor needs an HTML ↔ TipTap converter in
  `packages/shared`, held to the same bar as `note-markdown.ts`: fixtures, the
  seeded fuzz, and the web schema test. `isMarkdownEditable`'s safety rule
  carries over: what the editor cannot represent stays read-only.
- Underline becomes editable, so a note with underline stops being read-only.
- Toolbar: bold, italic, strikethrough, bullets, numbers, as asked. The P11
  toolbar's limits (scrolls away in a long note) are worth fixing at the same
  time.

### P17 — Redesign

Chosen 2026-10-17. Four directions after Spotify / Spotify for Artists were
built side by side (branches `redesign/a-s4a-home`, `b-spotify-dark`,
`c-wrapped`, `d-s4a-pages`) and screenshotted; the user picked **C's
calendar** and asked to keep the existing widget cards, only in the new face,
with C's masthead on the widget page. Branch `feat/mobile-redesign`. Web is
not touched.

- **Face:** Figtree (`@expo-google-fonts/figtree`, loaded at runtime with
  `expo-font`, so no native rebuild), tokens in `apps/mobile/src/theme/poster.ts`.
- **Widget page:** today's date in small caps over the band name set huge
  (tap to switch band), the header title fading in once it scrolls away, ⋯ as
  an outlined circle. Cards keep their palette colours and layout; their text
  is Figtree.
- **Calendar:** C's poster agenda (huge month, giant day numbers; C's "This
  week" summary block removed at the user's request). Every item wears **its widget's colour in its own band**: a show is
  the band's Shows card colour, a rehearsal its Next Rehearsals colour, a due
  task its To-Do's colour (`widgetInk`, the same rule as `use-hub-cards`).
  Events are blocks; tasks, goals and reminders are rows with a badge in that
  colour. Each band's theme comes from the new `useBoards` hook in
  `@artist/api-client` (same `["board", id]` key as `useBoard`).
- Both screens sit on the app's own canvas, so a plain widget looks the same
  on both. Approved by the user on 2026-10-17.
- **Step 2, widget screens (spokes):** a playlist-style header on each (a cover
  in the widget's colour with its icon, the name set large, a summary line);
  the widget pills as Spotify chips, the active one in its widget's colour;
  `Row`, `SpokeList` and `ListState` set in Figtree (so lists on other screens
  pick up the face too). Trap: `adjustsFontSizeToFit` in a horizontal pager
  measures off-screen pages at zero width and stays shrunk, so the header
  title wraps instead.
- **Step 3, detail screens (task / event / goal):** each opens with a block in
  its widget's colour (`DetailPoster`, `features/board/detail-poster.tsx`), so
  it reads as the calendar block or card you tapped, opened up: a task in
  To-Do's, an event in Shows / Next Rehearsals / Next Meetings by type, a goal
  in Goals'. The kind in small caps across the top; an event's day set huge
  with "In 4 days" / "4 days ago" in the corner (`daysAway`), so a past event
  says it is past. The status pill and Complete / Reopen sit on the block in
  its own ink. Section captions, badges, comments, linked tasks and
  attachments are in Figtree; descriptions and comments use the new medium
  `paragraph` style. Buttons and the comment field wait for the forms step.
  Phone-checked by the user 2026-10-18.
- **Step 4, Inbox and You:** the Inbox opens with its count set as the
  calendar sets its month ("3 mentions", FOR YOU · band in small caps), and
  says "Nothing for you." in the same huge type as an empty month. Each
  mention is a tile with the sender's initial in the band's colour (the band
  is also named in words), the sentence, and the excerpt on its own lines.
  The notification ask is a block in the page's own ink with pill buttons.
  You is a profile: initial in a large round tile in the shown band's colour,
  the name set like the band on the widget page; the band it shows is a block
  in its colour that opens the band switcher. Shared on the way: `Button`
  is a Figtree capsule, the band filter chips (Calendar too) are Spotify chips
  like the widget pills, bar titles are Figtree, and `PosterPill` moved to
  `components/`.
- **Step 5, forms:** each create/edit form opens with the block the item will
  become (`FormPoster`, `features/forms/form-poster.tsx`): the kind in small
  caps ("NEW TASK", "EDIT SHOW") and the title typed straight onto a block in
  its widget's colour, set as large as on the detail screen and wrapping
  rather than scrolling. An event's block follows its Type chips, so a show
  switched to a rehearsal turns Next Rehearsals' colour before it is saved.
  The bar stays empty over a postered form, as over a detail screen. The
  fields are Figtree: small-caps labels (`FieldLabel`), flat filled inputs
  with no outline (`TextField`, `PickOne`, `DateField`), choice chips set as
  the band filter's, and Cancel / Save in the bar. One `EVENT_WIDGET` map in
  `spoke-header.tsx` replaces three copies. Focus and Notes keep their own
  layouts (Notes waits for P16). Trap: a single-line `TextInput` with a
  `lineHeight` draws its text off-centre on iOS, so `posterInput` drops it.
- **Step 6, sheets:** the band switcher is a wall of bands, each a block in
  its own colour (the You tab's band block), the one showing marked by a
  filled tick and "· SHOWING", never by colour alone, since two bands can
  share one. The board menu opens with the band it acts on (a small tile in
  its colour with its initial, then its name), then Spotify `⋯`-menu rows:
  a bare icon, a semibold title and a medium line, no box round each. The
  status sheet names the task as the detail block does, then bare rows; the
  current status is a filled row with a heavier name and a tick. The
  attachment name sheet has the form bar's Cancel / Save in Figtree, a
  small-caps NAME label and the flat filled field, with the extension inside
  it. Sheet layout (header-padded plain Views, the dismiss-then-push in the
  board menu) is unchanged, so the react-native#43546 and
  react-native-screens#4651 fixes stand.
- **Step 7, the rest:** `ThemedText` is set in Figtree (`uiText` in
  `theme/poster.ts`: Apple's sizes, Figtree faces, a line height each), so
  every screen that still used it — Settings, the attachment gallery and
  tiles, the archive and delete actions under a form, the hub's hints and
  empty states, the tabs' error — reads in the app's face. The Notes view
  alone keeps the system face, since its bold and italic marks are
  `fontWeight` / `fontStyle` (P16 replaces it). Sign-in opens with the
  widget page's masthead (BAND WALL in small caps over the greeting set
  huge) and loses its white system bar. The comment field is the forms'
  flat filled box. The attachment grid is set like Spotify's album grid:
  square art with tight corners and the name left-aligned. Also fixed: the
  widget pills stretched to half the screen, because the strip grew like
  any horizontal list (`flexGrow: 0`, as the band filter needed).
- **Step 8, light and dark:** every screen walked in both schemes on the
  simulator. The colours were already scheme pairs; what broke in the dark
  was elevation and a few native controls. A shadow on charcoal shows
  nothing, so a plain card was one step off the page and each palette's
  deepest colour (the playful ink, forest's bark, ocean's navy) sank into
  it. `useShadows()` (`theme/shadows.ts`) keeps the light shadows and in the
  dark draws the web's answer instead, a 1px inset ring of the page ink at
  10% (web: `ring-1 ring-foreground/10`), on every card, block, poster and
  palette swatch. A plain widget's active pill was its card colour, a step
  off the resting grey, so it now fills with ink as the band filter does.
  iOS dims a form sheet's bar title in the dark whatever colour it is given
  (pure red came out dark red), so the three sheets' titles are drawn in
  React. The settings switches' white thumb vanished into the near-white
  track; it is now the ink's opposite. Not changed: the launch splash is
  still Expo's template (blue, Expo mark) in both schemes, which needs a
  logo and a native build.
- **Done 2026-10-19.** Every step's checks ticked on the Trello card (the one
  open item, Step 4's first-run notification prompt, has its own Backlog
  reminder) and `feat/mobile-redesign` merged into `feat/mobile-app`. The
  branded splash and icon are a follow-up, not part of P17.

### P18 — Join links

Chosen 2026-10-20, replacing the email-invite code flow (P10c invites, the
`6be2633` join-with-code sign-in). Researched against BAND (link, short code,
reusable QR) and Discord (one link per server).

**Decisions (user, 2026-10-20):** links never expire; every join needs an
admin's approval; admins get an alert on the board's widget page and a push
when someone asks to join.

**Flow**
1. Each band has one join link + short code, e.g. `bandwall.app/j/K7Q2MX`.
   Admins can reset it (old link stops working). Never expires.
2. Phone band Settings: **Share invite** → iOS share sheet (Messages,
   WhatsApp…), plus the code and a QR for in-person. Web Settings gets the same.
3. Opening the link: app installed → "Join Neon Harbor?"; not installed → a
   web page with the App Store button and the code. In-app "Have a band code?"
   on sign-in / Your bands covers the install gap (no deferred deep links in
   Expo without a paid service).
4. Sign in or create an account → **Ask to join** → a pending join request.
   The person sees "Waiting for an admin" until decided.
5. Admins: an alert block on the band's widget page ("Sam wants to join ·
   Approve / Decline") and a push (new `JOIN_REQUEST` category, routes to the
   band). Approve creates the Membership (USER); decline removes the request.
   The requester gets a push either way.
6. Email invites stay as a secondary option, sending the same link.

**Build steps**
- API: `Board.joinCode` (unique, regenerable), `JoinRequest` model
  (board, user, status, createdAt), endpoints: preview by code, request,
  list pending (admin), approve/decline, reset code. Permission
  `member.invite` in the shared map. Jest units only.
- Notifications: `JOIN_REQUEST` (admins) and `JOIN_DECIDED` (requester),
  push + preference category.
- Mobile: universal-link route `/j/[code]`, join screen, code entry, Share
  invite + QR in Settings, pending-requests alert on the hub, waiting state.
- Web: `/j/[code]` page (join or get the app), Settings share/reset, pending
  requests on the dashboard.
- Retire: the invite-code sign-in mode and custom invite email template.
- Needs: associated domain / universal links → a new dev build.

## Library replacement reference

| Web | Mobile | Risk |
|---|---|---|
| shadcn/ui + Tailwind + `@base-ui/react` | `StyleSheet` primitives + shared theme tokens | Low — 23 small `components/ui` files |
| `react-grid-layout` (dashboard grid) | Custom `reanimated` + `gesture-handler`; layout maths reused from `packages/shared` | **High** |
| `@dnd-kit` (todos reorder only) | `reanimated` drag list / `draggable-flatlist` | Low — one file |
| `@tiptap` (notes widget) | Native view + text field over a shared markdown converter (`note-markdown.ts`); not tentap, which is a WebView | Medium |
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
