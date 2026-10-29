# Band Wall

A shared workspace for a band or artist to run the business side of making music: a customizable dashboard of tasks, goals, shows, rehearsals, reminders, and notes, scoped to a band (board) the whole group shares. One account can be in several bands.

npm-workspaces monorepo: NestJS API + Next.js web app + Expo mobile app + shared TypeScript packages, backed by local Supabase (Postgres, Auth, Mailpit).

```
apps/api            NestJS 11 + Prisma 7
apps/web            Next.js 16 (client-only; Next is used for routing/SEO metadata, not RSC)
apps/mobile         Expo 57 / React Native (in progress — see docs/mobile-app.md)
packages/shared     Zod DTOs, the permission map and layout logic, consumed as TS source
packages/api-client apiFetch + the React Query hooks, shared by web and mobile
supabase/           local stack config (config.toml, seed.sql, the invite email template)
```

## What it does

- **Boards & membership** — email and password sign-in, with invites arriving as Supabase magic links; each board has ADMIN and USER roles. Anyone in more than one band switches between them with the band picker in the web header or the band list on the phone, and every item's detail view shows which band it belongs to. Admins invite members (by email), manage the board, and remove members; a single shared `can()` map (`packages/shared/src/permissions.ts`) is the source of truth for every permission, enforced server-side and mirrored in the UI.
- **Tasks** — statuses (customizable per board), priorities, due dates, assignees, nested subtasks, and per-task checklists. Members can only restatus tasks assigned to them; admins edit everything.
- **Planning** — goals (yearly/monthly/daily), events (shows, rehearsals, meetings), reminders, and per-period focus pins, all surfaced on a combined month **calendar** with type filters. On the phone the calendar spans every band you're in.
- **Show statuses** — each show has a status (Hold, Details pending, Confirmed, Cancelled by default), and admins add their own steps, the same way as task statuses. Cancelled shows are struck through and left out of counts, and a past booked show reads as Played. See [docs/plans/show-statuses.md](docs/plans/show-statuses.md).
- **Finances** — a band ledger of income and expenses with splits, payouts, receipts, notes, filters and CSV export, plus each member's expense and payout history (`/finances` on web, the Finances widget on the phone).
- **Item details** — tasks, events, goals and reminders carry titled plain-text notes and named web links.
- **Customizable dashboard** — a drag-and-drop widget grid (react-grid-layout). Each member arranges their own layout; admins set the board default; the phone has its own arrangement. Widgets: Focus, To-Dos, My Tasks, Goals, Shows, Next Rehearsals, Next Meetings, Reminders, Activity, Finances, and a rich-text Notes widget (TipTap). Board palettes set the widget colours.
- **Collaboration** — comments with @mentions (and a persistent mentions notification indicator), file attachments via signed URLs (private Storage bucket), and a boardwide activity feed logging every meaningful change.
- **Notifications** — email (Resend, or Mailpit in dev) and push to the phone app, with per-category preferences and one-click unsubscribe. See [docs/notifications.md](docs/notifications.md).
- **Archive** — archived items can be restored or deleted for good from the Archive page.

## Prerequisites

- **Node 24+** and npm 11+
- **Docker Desktop** — the Supabase stack runs in containers, so the daemon must be running before anything else
- **Supabase CLI** — `brew install supabase/tap/supabase`

## First-time setup

```bash
npm install
```

Ensure env variables are in place. See the example files — copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env.local`, then fill in the values (`npx supabase status` prints the keys). For the phone app, copy `apps/mobile/.env.example` to `apps/mobile/.env`; see [apps/mobile/README.md](apps/mobile/README.md). `APP_ENV`, `LOG_LEVEL` and the Sentry DSNs are optional locally; [docs/error-handling.md](docs/error-handling.md) explains them.

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

Sign in on `/login` with an email and password, or create an account there. Invites are the only magic links: they arrive in **Mailpit** at http://127.0.0.1:54324 (no real mail is sent), and the invited person sets a password on the web, or enters the email's 6-digit code under "Join with an invite code" on the phone. Both apps sign in through the shared `AuthClient` (`packages/api-client/src/auth`), backed by Supabase Auth. First login calls `POST /me/bootstrap`, which creates the user, activates any email-matched invites, and provisions a board with default task statuses, show statuses and layout if you have none.

## Database changes

```bash
cd apps/api
npx prisma migrate dev --name <change_name>   # create + apply a migration
npx prisma migrate status                     # check for drift
npx prisma studio                             # browse data
```

`npx prisma generate` regenerates the client into `apps/api/generated/prisma` (gitignored) — rerun it after pulling schema changes.

On macOS, double-clicking [`run-db-reset.command`](run-db-reset.command) runs `prisma migrate deploy` and then the demo seed.

### Demo data

```bash
npm run db:seed -w apps/api
```

Fills a board with rich, lived-in demo data — synthetic bandmates, tasks across every status with checklists and subtasks, goals, shows in every show status (plus a custom "Advanced" one), rehearsals and meetings, reminders, a finance ledger, comments with a mention, and a full activity feed.

The seed targets a real account so you land on the data when you log in. By default it looks for `elton.salanic@gmail.com`; point it at your own account with `DEMO_OWNER_EMAIL=you@example.com npm run db:seed -w apps/api` (log in once first so the user and their board exist). It then **fills that user's existing board** (renaming it "Neon Harbor") rather than creating a second board they'd never see. If no matching account exists, it builds a standalone synthetic board instead.

It's **idempotent but destructive to that board's content**: each run wipes the board's tasks/goals/events/reminders/focus/comments/activity/notes widget/finances (memberships, task and show statuses, and personal layouts are preserved) and repopulates — so reseed freely, but don't point it at a board holding real data you care about.

## Tests

```bash
npm test                  # shared + api-client + api + web + mobile
npm test -w packages/shared       # typecheck + Jest units
npm test -w packages/api-client   # typecheck (DOM-free) + Jest units
npm test -w apps/api      # typecheck + Jest unit tests (no e2e/supertest by design)
npm test -w apps/web
npm test -w apps/mobile   # typecheck + Jest units
```

Lint with `npm run lint -w apps/api` / `-w apps/web` / `-w apps/mobile`. What a person has to click through per phase and feature is in [docs/test-checklist.md](docs/test-checklist.md); `phase_testing/` holds the older sign-off checklists for phases 4 and 5 of the web app.

## Troubleshooting

**Browser console floods with `ERR_CONNECTION_REFUSED` on `127.0.0.1:54321` and nothing renders.** Docker isn't running, so Supabase is down and the auth client can't refresh its token. Start Docker Desktop, then `supabase start`. If `supabase start` reports stopped services (`imgproxy`, `edge_runtime`, `pooler`), running it again brings them back.

**API returns 404 for a route you expect.** Almost all routes are board-scoped as `/boards/:boardId/<resource>` (tasks, events, goals, focus, reminders, calendar, finances, show-statuses, notes, links and so on). The root routes are `/health`, `/me` (and `/me/devices`), the cross-band `/calendar` and `/mentions`, `/unsubscribe` and `/webhooks/resend`. A guarded route hit without a token returns **401**, not 404 — so a 404 means the path is wrong, not that auth failed.

**Magic link lands on `/` instead of `/auth/callback`.** The redirect URL must be in `additional_redirect_urls` in `supabase/config.toml` — both the `127.0.0.1` and `localhost` spellings, since GoTrue matches exactly and silently drops anything unlisted. Restart the stack after editing config.
