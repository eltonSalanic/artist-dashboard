# Artist Dashboard

A shared workspace for a band or artist to run the business side of making music: a customizable dashboard of tasks, goals, shows, rehearsals, reminders, and notes, scoped to a board the whole group shares.

npm-workspaces monorepo: NestJS API + Next.js web app + shared TypeScript package, backed by local Supabase (Postgres, Auth, Mailpit).

```
apps/api        NestJS 11 + Prisma 7
apps/web        Next.js 16 (client-only; Next is used for routing/SEO metadata, not RSC)
packages/shared DTOs and layout logic, consumed as TS source
supabase/       local stack config (config.toml)
```

## What it does

- **Boards & membership** — magic-link auth; each board has ADMIN and USER roles. Admins invite members (by email), manage the board, and remove members; a single shared `can()` map (`packages/shared/src/permissions.ts`) is the source of truth for every permission, enforced server-side and mirrored in the UI.
- **Tasks** — statuses (customizable per board), priorities, due dates, assignees, nested subtasks, and per-task checklists. Members can only restatus tasks assigned to them; admins edit everything.
- **Planning** — goals (yearly/monthly/daily), events (shows, rehearsals, meetings), reminders, and per-period focus pins, all surfaced on a combined month **calendar** with type filters.
- **Customizable dashboard** — a drag-and-drop widget grid (react-grid-layout). Each member arranges their own layout; admins set the board default. Widgets: My Tasks, To-Dos, Goals, Focus, Shows/Rehearsals/Meetings, Reminders, Activity Feed, and a rich-text Custom (TipTap) widget.
- **Collaboration** — comments with @mentions (and a persistent mentions notification indicator), file attachments via signed URLs (private Storage bucket), and a boardwide activity feed logging every meaningful change.

## Prerequisites

- **Node 24+** and npm 11+
- **Docker Desktop** — the Supabase stack runs in containers, so the daemon must be running before anything else
- **Supabase CLI** — `brew install supabase/tap/supabase`

## First-time setup

```bash
npm install
```

Ensure env variables are in place. See the example files — copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then fill in the values.

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

### Demo data

```bash
npm run db:seed -w apps/api
```

Fills a board with rich, lived-in demo data — synthetic bandmates, tasks across every status with checklists and subtasks, goals, shows/rehearsals/meetings, reminders, comments with a mention, and a full activity feed.

Because the app is single-board (no board switcher — `/me` shows your oldest membership), the seed targets a real account so you land on the data when you log in. By default it looks for `elton.salanic@gmail.com`; point it at your own account with `DEMO_OWNER_EMAIL=you@example.com npm run db:seed -w apps/api` (log in once first so the user and their board exist). It then **fills that user's existing board** (renaming it "Neon Harbor") rather than creating a second board they'd never see. If no matching account exists, it builds a standalone synthetic board instead.

It's **idempotent but destructive to that board's content**: each run wipes the board's tasks/goals/events/reminders/focus/comments/activity (memberships, statuses, and personal layouts are preserved) and repopulates — so reseed freely, but don't point it at a board holding real data you care about.

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
