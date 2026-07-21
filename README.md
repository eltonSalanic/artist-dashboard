# Artist Dashboard

npm-workspaces monorepo: NestJS API + Next.js web app + shared TypeScript package, backed by local Supabase (Postgres, Auth, Mailpit).

```
apps/api        NestJS 11 + Prisma 7
apps/web        Next.js 16 (client-only; Next is used for routing/SEO metadata, not RSC)
packages/shared DTOs and layout logic, consumed as TS source
supabase/       local stack config (config.toml)
```

## Prerequisites

- **Node 24+** and npm 11+
- **Docker Desktop** — the Supabase stack runs in containers, so the daemon must be running before anything else
- **Supabase CLI** — `brew install supabase/tap/supabase`

## First-time setup

```bash
npm install
```

Env files are gitignored, so create both by hand.

`apps/api/.env`:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase start`>
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
PORT=3001
WEB_URL=http://localhost:3000
```

`apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase start`>
NEXT_PUBLIC_API_URL=http://localhost:3001
```

The keys are the fixed local demo keys — `supabase start` reprints them any time, and `supabase status` shows them for a running stack.

Then apply the schema:

```bash
supabase start
cd apps/api && npx prisma migrate deploy && npx prisma generate
```

## Running day to day

Start Docker Desktop first, then:

```bash
supabase start     # idempotent; safe to run when already up
npm run dev        # concurrently runs api (3001) and web (3000)
```

`npm run dev` from the root starts both apps with watch mode. To run just one: `npm run dev -w apps/api` or `-w apps/web`.

| Service | URL |
| --- | --- |
| Web app | http://localhost:3000 |
| API | http://localhost:3001 |
| Supabase API / Auth | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit (magic-link inbox) | http://127.0.0.1:54324 |

Stop the stack with `supabase stop`. Data persists between restarts; `supabase stop --no-backup` wipes it.

### Logging in

Auth is magic-link only. Enter an email on `/login`, then open **Mailpit** at http://127.0.0.1:54324 and click the link there — no real mail is sent. First login calls `/me/bootstrap`, which creates the user, activates any email-matched invites, and provisions a board with default statuses and layout if you have none.

## Database changes

```bash
cd apps/api
npx prisma migrate dev --name <change_name>   # create + apply a migration
npx prisma migrate status                     # check for drift
npx prisma studio                             # browse data
```

`npx prisma generate` regenerates the client into `apps/api/generated/prisma` (gitignored) — rerun it after pulling schema changes.

## Tests

```bash
npm test                  # api + web
npm test -w apps/api      # Jest unit tests (no e2e/supertest by design)
npm test -w apps/web
```

Lint with `npm run lint -w apps/api` / `-w apps/web`.

## Troubleshooting

**Browser console floods with `ERR_CONNECTION_REFUSED` on `127.0.0.1:54321` and nothing renders.** Docker isn't running, so Supabase is down and the auth client can't refresh its token. Start Docker Desktop, then `supabase start`. If `supabase start` reports stopped services (`imgproxy`, `edge_runtime`, `pooler`), running it again brings them back.

**API returns 404 for a route you expect.** Almost all routes are board-scoped as `/boards/:boardId/<resource>` (tasks, events, goals, focus, reminders, calendar). Only `/health` and `/me` live at the root. A guarded route hit without a token returns **401**, not 404 — so a 404 means the path is wrong, not that auth failed.

**Magic link lands on `/` instead of `/auth/callback`.** The redirect URL must be in `additional_redirect_urls` in `supabase/config.toml` — both the `127.0.0.1` and `localhost` spellings, since GoTrue matches exactly and silently drops anything unlisted. Restart the stack after editing config.
