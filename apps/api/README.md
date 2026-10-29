# `apps/api` — the Band Wall API

NestJS 11 + Prisma 7 (the `prisma-client` generator with the `@prisma/adapter-pg`
driver adapter). It owns the `public` schema; Supabase owns `auth` and
`storage`. Setup, commands and the migration rules are in the root
[README.md](../../README.md) and [CLAUDE.md](../../CLAUDE.md).

## Running it

```bash
cp .env.example .env     # fill in from `npx supabase status`
npm run dev              # watch mode on PORT (3001), or `npm run dev` from the repo root for api + web
```

[`src/config/env.ts`](src/config/env.ts) refuses to boot when a required
variable is missing, and outside development also requires `WEB_URL` and
`API_URL`. Every variable is described in [`.env.example`](.env.example).

## Layout

- **One module per feature** under `src/`: `tasks`, `statuses`, `events`,
  `show-statuses`, `goals`, `focus`, `reminders`, `calendar`, `notes`,
  `links`, `finances`, `comments`, `mentions`, `attachments`, `activity`,
  `archive`, `custom-widget`, `layouts`, `boards`, `invites`, `users`,
  `notifications`, `health`. Almost every route is board-scoped,
  `/boards/:boardId/<resource>`.
- **`src/auth`** runs sign-in: Better Auth mounted at `/api/auth` (users and
  sessions in the `Auth*` tables), and `SessionAuthGuard`, which checks the
  bearer session token on every route not marked `@Public()`. Invites mail a
  6-digit code through `src/invites/invite-code.mail.ts`. **`src/common`** holds the board
  role and user-boards guards, the Zod validation pipe, the global exception
  filter, the request-id middleware and log redaction (see
  [docs/error-handling.md](../../docs/error-handling.md)).
- **Permissions** come from the shared `can()` map in
  `packages/shared/src/permissions.ts`, never a hardcoded role check.
- **`prisma/`** holds the schema, migrations, the destructive demo seed
  (`npm run db:seed`) and the diagnostic mail script (`npm run mail:test`).

## Tests

```bash
npm test              # tsc --noEmit, then Jest
npm run test:watch
npm run test:cov
```

Jest units only, with Prisma mocked (see the `*.spec.ts` beside each service).
There are no e2e or supertest HTTP tests, by design.
