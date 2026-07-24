# CLAUDE.md — Artist Dashboard

Guidance for working in this repo. For *what the product does* and the module map, read [README.md](README.md) first — this file is about **how we build**: which skills to use, the conventions to follow, and the sharp edges to watch for.

npm-workspaces monorepo:

```
apps/api        NestJS 11 + Prisma 7 (driver adapter, PrismaPg)   → owns the DB schema
apps/web        Next.js 16 (CLIENT-ONLY — routing/SEO only, no RSC/server actions)
packages/shared Zod DTOs + permission map + layout logic, consumed as TS source
supabase/       local stack (config.toml, seed.sql) — Postgres, Auth, Storage, Mailpit
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
- **`supabase`** — anything touching Supabase: Auth (magic-link/JWT/RLS), Storage (the private `attachments` bucket), the CLI/local stack, or a schema change on the Supabase side.
- **`supabase-postgres-best-practices`** — indexing/query/schema review on the Postgres layer.

### Frontend — `apps/web` (Next.js 16, client-only)
- **`shadcn`** — we use shadcn/ui (+ `@base-ui/react`, `class-variance-authority`, Tailwind v4). Use it to add/compose/debug components; there's a `components.json`.
- **`frontend-design`** — when creating or reshaping UI and you want intentional, non-templated visual design.
- **`vercel-react-best-practices`** — React 19 / Next perf review.
- ⚠️ **`nextjs-app-router-patterns` mostly does NOT apply.** That skill is about Server Components, streaming, and server-side data fetching — all of which this project deliberately avoids (see convention below). Ignore its RSC guidance; only its routing/file-convention bits are relevant.

---

## Non-negotiable conventions

These are project rules the user has set. Follow them without re-litigating.

- **Latest versions only.** Always install `@latest` and adapt code to new majors — never downgrade a dependency to make something compile. We are intentionally on bleeding-edge Next 16, React 19, Prisma 7, Tailwind 4.
- **Next.js is client-only.** Next is used for routing and SEO metadata, *not* React Server Components or server actions. Don't introduce `"use server"`, server-side data fetching, or RSC-only patterns. Data flows: web → NestJS API (TanStack Query) → Prisma → Postgres.
- **`⚠️ This is not the Next.js you know.`** Next 16 has breaking changes vs. training data. Per [apps/web/AGENTS.md](apps/web/AGENTS.md), consult `node_modules/next/dist/docs/` before writing Next code.
- **API tests are Jest units only.** No supertest / e2e HTTP tests. Mock Prisma (see the `*.spec.ts` alongside services).
- **No `Co-Authored-By` trailer on commits.** Leave it off entirely.
- **Permissions have one source of truth.** `packages/shared/src/permissions.ts` (`can()` map) is enforced server-side *and* mirrored in the UI. Never hardcode a role check — extend the shared map.

---

## Two migration systems (know which owns what)

One Postgres database, multiple schemas with different owners. **They never overlap.**

| Schema | Owned by | Managed with |
|---|---|---|
| `public` (app tables + `_prisma_migrations`) | **Prisma** | `prisma migrate` — [apps/api/prisma/migrations/](apps/api/prisma/migrations/) |
| `auth` (users, sessions) | **Supabase** | Supabase itself — never via Prisma |
| `storage` (objects, buckets) | **Supabase** | [supabase/seed.sql](supabase/seed.sql) creates the `attachments` bucket |

- **Prisma owns your app schema.** `prisma migrate dev` locally (needs a shadow DB); **`prisma migrate deploy`** in prod/CI (idempotent, no shadow DB, never resets).
- The seam between systems: `public.User.id` **equals** the Supabase `auth.users.id` (UUID, by convention — no cross-schema FK). Auth mints the identity; the API provisions the matching `User` row.
- **`apps/api/prisma/seed.ts` is DEMO data** (board "Neon Harbor" + synthetic bandmates) and is **destructive to that board's content** on every run. Never run it in prod. It is *not* wired into `prisma migrate` — it's a manual `npm run db:seed`.
- Seeding does **not** create attachments or auth users; the one `FILE_UPLOADED` feed entry is display text only.

### Connection strings for prod (Supabase)
Currently a single `DATABASE_URL` serves both runtime and migrations (fine for local). For a Supabase prod deploy, split them:

- `DATABASE_URL` → **pooled** (Supavisor, port 6543) for the running API (the driver adapter).
- `DIRECT_URL` → **direct** (port 5432) for `prisma migrate deploy` (advisory lock + DDL need a real session). Point [apps/api/prisma.config.ts](apps/api/prisma.config.ts) at `DIRECT_URL`.

Neither Prisma nor Supabase deploys the NestJS/Next.js *code* — those need their own hosts (e.g. Railway/Render for the API, Vercel for web) pointed at Supabase's connection strings + keys. Server-only secrets: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`. The web app only ever gets the `anon` key + `NEXT_PUBLIC_API_URL`.

---

## Commands

```bash
npm run dev                 # both apps (concurrently) — from repo root
npm run test                # api + web test suites
npm run db:seed -w apps/api # (re)seed the demo board — DESTRUCTIVE, dev only
npx prisma migrate dev      # from apps/api — new migration in dev
npx prisma migrate deploy   # from apps/api — apply migrations in prod/CI
npx supabase start|stop     # local Supabase stack
```

Local Supabase runs in Docker (`supabase_db_artist-dashboard`, `supabase_storage_artist-dashboard`); mail is caught by Mailpit at `127.0.0.1:54324`.
