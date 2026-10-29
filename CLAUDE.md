# CLAUDE.md — Artist Dashboard

Guidance for working in this repo. For *what the product does* and the module map, read [README.md](README.md) first — this file is about **how we build**: which skills to use, the conventions to follow, and the sharp edges to watch for.

npm-workspaces monorepo:

```
apps/api            NestJS 11 + Prisma 7 (driver adapter, PrismaPg)   → owns the DB schema
apps/web            Next.js 16 (CLIENT-ONLY — routing/SEO only, no RSC/server actions)
apps/mobile         Expo 57 / React Native (P14 store builds and P18 join links still open — see docs/mobile-app.md)
packages/shared     Zod DTOs + permission map + layout logic, consumed as TS source
packages/api-client apiFetch + React Query hooks — platform-agnostic, shared by web + mobile
supabase/           local stack (config.toml, seed.sql) — Postgres, Storage, Mailpit
```

Scoped instructions also live in [apps/web/CLAUDE.md](apps/web/CLAUDE.md) → [apps/web/AGENTS.md](apps/web/AGENTS.md). Read those when touching the web app.

---

## Skills to use

Skills are set up in this repo. Reach for them **before** writing code in the matching area — they carry version-specific detail (Prisma 7, Next 16) that overrides stale training data.

### Backend — `apps/api` (NestJS + Prisma 7)
Prisma skills are installed under `apps/api/.claude/skills/` and are **scoped to `apps/api/`** — prefer the scoped variant when editing files there.

- **`prisma-client-api`** — writing queries (`findMany`, `create`, `$transaction`, filters). Use for any DB access code.
- **`prisma-cli`** — `migrate`, `generate`, `db`, `studio` workflows.
- **`prisma-driver-adapter-implementation`** — **required reading** if you touch anything about the connection/adapter. We run the Prisma 7 `prisma-client` generator with the `@prisma/adapter-pg` driver adapter (see [apps/api/src/prisma/prisma.service.ts](apps/api/src/prisma/prisma.service.ts)), not the classic engine.
- **`prisma-upgrade-v7`** — context on the v7 breaking changes we're already on (new generator, `prisma.config.ts`, driver adapter required).
- **`prisma-database-setup`** / **`prisma-postgres`** / **`prisma-postgres-setup`** — provisioning/connection-string work, e.g. wiring a prod database.
- **`nestjs-best-practices`** — modules, DI, guards, validation. Use when adding or refactoring API modules.

### Database / platform — Supabase & Postgres
- **`supabase`** — anything touching Supabase: Storage (the private `attachments` bucket), RLS, the CLI/local stack, or a schema change on the Supabase side. Sign-in is **not** Supabase any more: it is Better Auth inside the API (see the Auth convention below).
- **`supabase-postgres-best-practices`** — indexing/query/schema review on the Postgres layer.

### Frontend — `apps/web` (Next.js 16, client-only)
- **`shadcn`** — we use shadcn/ui (+ `@base-ui/react`, `class-variance-authority`, Tailwind v4). Use it to add/compose/debug components; there's a `components.json`.
- **`frontend-design`** — when creating or reshaping UI and you want intentional, non-templated visual design.
- **`vercel-react-best-practices`** — React 19 / Next perf review.
- ⚠️ **`nextjs-app-router-patterns` mostly does NOT apply.** That skill is about Server Components, streaming, and server-side data fetching — all of which this project deliberately avoids (see convention below). Ignore its RSC guidance; only its routing/file-convention bits are relevant.

### UI design — both apps (installed 2026-10-17 for the UI refresh)
- **`impeccable`** (repo root, pbakaus/impeccable) — design direction, critique, audit, polish, typeset, layout; covers app UI ("Operate" mode) and native iOS/Android screens. Its launcher downloads a small binary on first run; the skill's documented fallback (read PRODUCT.md / DESIGN.md directly) works without it.
- **`ui-ux-pro-max`** (repo root) — searchable local reference: palettes, font pairings, UX rules, per-stack guidance incl. React Native. Python 3 script, no network.
- **`web-design-guidelines`** (`apps/web` only, Vercel) — audit web UI against Vercel's interface guidelines.

### Mobile — `apps/mobile` (Expo / React Native)
17 skills are installed under `apps/mobile/.claude/skills/` and are **scoped to `apps/mobile/`** — they stay inert while you edit `apps/web`, which matters because several carry opinions that are wrong advice for the Next app. The per-area routing table lives in [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md); read it before writing mobile code.

- Official Expo (14): `expo-overview`, `expo-project-structure`, `expo-router`, `expo-dev-client`, `expo-web-to-native`, `expo-data-fetching`, `expo-design-system`, `expo-native-ui`, `expo-animation`, `expo-upgrade`, `eas-app-stores`, `eas-update`, `eas-workflows`, `eas-simulator`.
- Third-party (3): `animate-expo`, `vercel-react-native-skills`, `upgrading-react-native`.
- ⚠️ **No skill covers Expo push notifications or `expo-secure-store`/auth sessions.** Those are the two highest-risk areas (plan phases P5 and P13) — work from Expo's docs and verify on a physical device.
- ⚠️ **`expo-tailwind-setup`, `expo-ui`, `use-dom`/`expo-dom` are deliberately NOT installed.** Mobile styling is React Native `StyleSheet` (NativeWind declined), and webviews are out — Expo was chosen over a Capacitor wrapper to avoid one.

---

## Non-negotiable conventions

These are project rules the user has set. Follow them without re-litigating.

- **Latest versions only.** Always install `@latest` and adapt code to new majors — never downgrade a dependency to make something compile. We are intentionally on bleeding-edge Next 16, React 19, Prisma 7, Tailwind 4.
- **Next.js is client-only.** Next is used for routing and SEO metadata, *not* React Server Components or server actions. Don't introduce `"use server"`, server-side data fetching, or RSC-only patterns. Data flows: web → NestJS API (TanStack Query) → Prisma → Postgres.
- **`⚠️ This is not the Next.js you know.`** Next 16 has breaking changes vs. training data. Per [apps/web/AGENTS.md](apps/web/AGENTS.md), consult `node_modules/next/dist/docs/` before writing Next code.
- **API tests are Jest units only.** No supertest / e2e HTTP tests. Mock Prisma (see the `*.spec.ts` alongside services).
- **No `Co-Authored-By` trailer on commits.** Leave it off entirely.
- **Keep the docs current.** Any major change (a new feature, a changed behaviour or flow, a new env var, command or migration, a new route or module) updates the docs in the same branch: the root [README.md](README.md) feature list and setup, the matching file in [docs/](docs/README.md) and its status line in the docs index, [docs/test-checklist.md](docs/test-checklist.md), the plan's state in [docs/plans/](docs/plans/README.md), and the app README or `.env.example` it touches. Before calling work done, check that no doc still describes the old behaviour.
- **Auth goes through `AuthClient`.** Web and mobile screens call `auth` from their `src/lib/auth.ts`, never a provider directly. The interface lives in `packages/api-client/src/auth/auth-client.ts` and the Better Auth version in `better-auth-client.ts` next to it; the server side is Better Auth mounted at `/api/auth` in the API ([apps/api/src/auth/better-auth.ts](apps/api/src/auth/better-auth.ts)), and every API request is checked by `SessionAuthGuard`; failures come back as `{ error }` for `authErrorMessage()`, and a 401 from the API still goes through `onUnauthorized`. A new auth need is a new `AuthClient` method, not a direct provider call.
- **Permissions have one source of truth.** `packages/shared/src/permissions.ts` (`can()` map) is enforced server-side *and* mirrored in the UI. Never hardcode a role check — extend the shared map.

---

## Trello — keep the Band Board up to date

The user tracks work and phone testing on the **Band Board** Trello board: https://trello.com/b/xsGE7BMR/band-board. Update it as you go, through the claude.ai Trello connector. Read list IDs with `trelloReadList list_by_board`; never guess them.

- **Tickets:** when you start one, move its card to **Dev**. When it's built, move it to **Testing** and comment with the commit hash, what changed and how to test it. Only the user moves cards to **Done**.
- **Phases:** each phase or redesign step gets one card in Testing, named "P<n> — <name> testing", with a Trello checklist (🔵 priority checks first). When a later step of the same phase lands, add a checklist for it to that card. Link the card from a short section in [docs/test-checklist.md](docs/test-checklist.md).
- **When the user confirms a check in chat**, tick it on the card.
- **Failures** found while testing become their own cards.
- **Names:** refer to cards by their title, not their number; the user can't see card numbers in Trello.

---

## Two migration systems (know which owns what)

One Postgres database, multiple schemas with different owners. **They never overlap.**

| Schema | Owned by | Managed with |
|---|---|---|
| `public` (app tables, the `Auth*` sign-in tables, `_prisma_migrations`) | **Prisma** | `prisma migrate` — [apps/api/prisma/migrations/](apps/api/prisma/migrations/) |
| `auth` | **Supabase** (unused) | Supabase still creates it; nothing in the app reads it since the move to Better Auth |
| `storage` (objects, buckets) | **Supabase** | [supabase/seed.sql](supabase/seed.sql) creates the `attachments` bucket |

- **Prisma owns your app schema.** `prisma migrate dev` locally (needs a shadow DB); **`prisma migrate deploy`** in prod/CI (idempotent, no shadow DB, never resets).
- The seam between sign-in and the app: `User.id` **equals** `AuthUser.id` (a UUID, by convention — no FK). Better Auth owns the `Auth*` tables through its Prisma adapter; `POST /me/bootstrap` provisions the matching `User` row. Don't edit `Auth*` rows by hand except to reset local test data.
- **`apps/api/prisma/seed.ts` is DEMO data** (board "Neon Harbor" + synthetic bandmates) and is **destructive to that board's content** on every run. Never run it in prod. It is *not* wired into `prisma migrate` — it's a manual `npm run db:seed`.
- Seeding does **not** create attachments or auth users; the one `FILE_UPLOADED` feed entry is display text only.

### Connection strings for prod (Supabase)
Currently a single `DATABASE_URL` serves both runtime and migrations (fine for local). For a Supabase prod deploy, split them:

- `DATABASE_URL` → **pooled** (Supavisor, port 6543) for the running API (the driver adapter).
- `DIRECT_URL` → **direct** (port 5432) for `prisma migrate deploy` (advisory lock + DDL need a real session). Point [apps/api/prisma.config.ts](apps/api/prisma.config.ts) at `DIRECT_URL`.

Neither Prisma nor Supabase deploys the NestJS/Next.js *code* — those need their own hosts (e.g. Railway/Render for the API, Vercel for web) pointed at Supabase's connection strings + keys. Server-only secrets: `SUPABASE_SERVICE_ROLE_KEY` (Storage) and `BETTER_AUTH_SECRET` (sessions and invite codes; rotating it signs everyone out). The web and phone apps only get the API's URL; they hold no Supabase key.

---

## Commands

```bash
npm run dev                 # both apps (concurrently) — from repo root
npm run test                # shared, api-client, api, web and mobile test suites
npm run db:seed -w apps/api # (re)seed the demo board — DESTRUCTIVE, dev only
npx prisma migrate dev      # from apps/api — new migration in dev
npx prisma migrate deploy   # from apps/api — apply migrations in prod/CI
npx supabase start|stop     # local Supabase stack
npm run mobile              # Expo for the phone — same Wi-Fi as this machine
npm run mobile:tunnel       # Expo + API + Supabase over ngrok — any network (tunnel.sh)
```

Local Supabase runs in Docker (`supabase_db_artist-dashboard`, `supabase_storage_artist-dashboard`); mail is caught by Mailpit at `127.0.0.1:54324`.
