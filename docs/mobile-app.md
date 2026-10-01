# Mobile App (React Native + Expo)

> **Status:** in progress. P0 (groundwork) is done; P1 is next. No Expo app
> exists yet — `apps/mobile/` currently holds only skills and agent docs.
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

`packages/api-client` is the keystone. The existing hooks in
`apps/web/src/features/*/use-*.ts` contain no web-specific code, so extracting
them hands the mobile app the entire data layer — cache keys, optimistic
updates, invalidation — for free, and makes a server contract change a
one-place fix.

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
| P1 | **26 files** change their `apiFetch` import; **19 hook files** move out of `features/`; `lib/api.ts` is replaced by a factory | No — the extraction *is* a web refactor. Behaviour-neutral by definition; the web Jest suite is the check. |
| P2 | 3 files touch `EmailCategory` (`notifications-card.tsx`, `settings-page.tsx`, `unsubscribe/page.tsx`) | Yes — keep `export type EmailCategory = NotificationCategory` as an alias. |
| P3 | **15 files** import `useMe`/`MeResponse`; **6 read `.board` directly**, incl. `app-shell.tsx`, which gates the whole authed app on `me.data.board` being non-null | Yes — add `boards[]` while keeping `board` populated with the first membership. |

Deferred consequence: a user in three bands on web will silently see only the
first one. That is a real bug, and closing it is **P15 (web board switcher)**,
deliberately scheduled after mobile rather than blocking it.

## Phases

| # | Phase | Touches | Status |
|---|---|---|---|
| **P0** | [Groundwork](#p0--groundwork) — skills, docs, branch | tooling | ☑ |
| **P1** | [`packages/api-client` extraction](#p1--packagesapi-client-extraction) | shared, **web** | ☐ |
| **P2** | [Notification channels + push transport](#p2--notification-channels--push-transport) | api, shared | ☐ |
| **P3** | [Multi-board API](#p3--multi-board-api) | api, shared | ☐ |
| **P4** | [Cross-board calendar + inbox](#p4--cross-board-calendar--inbox) | api, shared | ☐ |
| **P5** | [Expo skeleton + auth on a real device](#p5--expo-skeleton--auth-on-a-real-device) | mobile | ☐ |
| **P6** | [Primitives + design tokens](#p6--primitives--design-tokens) | mobile | ☐ |
| **P7** | [Board hub (stat cards)](#p7--board-hub-stat-cards) | mobile | ☐ |
| **P8** | [Spokes (expanded widgets)](#p8--spokes-expanded-widgets) | mobile | ☐ |
| **P9** | [Calendar + Inbox screens](#p9--calendar--inbox-screens) | mobile | ☐ |
| **P10** | [Write parity](#p10--write-parity) | mobile | ☐ |
| **P11** | [Notes widget](#p11--notes-widget) | mobile | ☐ |
| **P12** | [Mobile layout editor](#p12--mobile-layout-editor) | mobile | ☐ |
| **P13** | [Push client](#p13--push-client) | mobile, api | ☐ |
| **P14** | [Store builds](#p14--store-builds) | mobile, CI | ☐ |
| **P15** | [Web board switcher](#p15--web-board-switcher) | **web** | ☐ |

Each phase ends with a **hard stop for manual verification** before the next
begins, per the project's phase-gated convention.

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

Move `apiFetch` and the ~19 TanStack Query hooks into a new workspace package;
point `apps/web` at it. Invert the token source and base URL as described in
[Architecture](#architecture).

Pure refactor. **Done means: `apps/web` behaves identically and its Jest suite
is green.** No feature work, no UI change. Largest single web diff in the
project, and the highest-leverage move in it.

Rejected alternative: copy the hooks into the package and leave web on its own
copies. Two divergent data layers is exactly the tax the package exists to
prevent.

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

### P6 — Primitives + design tokens

Build the token layer and base components in `StyleSheet`: `Card`, `Text`,
`Badge`, `Sheet`, `Skeleton`, tab bar, header.

Tokens consume `packages/shared/src/theme.ts` and `resolveBoardTheme()`, the
same source the web app uses for per-board palettes — so a board's colours are
identical on both platforms, and board colour-coding in P9 comes free.

Use the `expo-design-system` skill: it explicitly covers auditing for
hardcoded colours/spacing/fonts and the "looks AI-generated instead of native"
tells. `expo-native-ui` covers HIG semantics, safe areas, and responsive
layout.

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

### P8 — Spokes (expanded widgets)

Port the existing `Expanded` components from the widget registry. The registry
already defines `Collapsed` and `Expanded` for all ten widget types, so the
hub/spoke split matches the code's existing shape.

The tab strip lives **here**, not on the hub — once you have context, lateral
movement is useful. Swipe between widgets, with a strip showing position
(Photos' grid → tap → swipe pattern).

Routes must be addressable for P13 deep links: `/board/[boardId]`,
`/board/[boardId]/w/[widgetType]`, `/board/[boardId]/task/[taskId]`.

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
