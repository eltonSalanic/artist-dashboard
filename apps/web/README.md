# `apps/web` — Band Wall on the web

Next.js 16, React 19, Tailwind 4 and shadcn/ui. **Client-only:** Next is used
for routing and SEO metadata, not Server Components or server actions. Data
goes web → NestJS API (TanStack Query hooks from `packages/api-client`) →
Prisma → Postgres. Next 16 differs from what you may know; read
[AGENTS.md](AGENTS.md) before writing Next code.

## Running it

```bash
cp .env.example .env.local   # only NEXT_PUBLIC_API_URL is needed locally
npm run dev                  # port 3000, or `npm run dev` from the repo root for api + web
```

A production build fails without `NEXT_PUBLIC_API_URL`. `NEXT_PUBLIC_APP_ENV`
and `NEXT_PUBLIC_SENTRY_DSN` are described in
[docs/error-handling.md](../../docs/error-handling.md).

## Layout

- **`src/app`** holds only routes: `/login`, `/auth/callback`, `/unsubscribe`,
  and inside `(app)` the signed-in pages `/dashboard`, `/calendar`,
  `/finances`, `/archive` and `/settings`, plus the error and not-found pages.
- **`src/features`** holds the screens and components, one folder per area
  (tasks, planning, finances, notes, links, dashboard, widgets, settings,
  shell and so on).
- **`src/lib/auth.ts`** is the web's `AuthClient` (from `@artist/api-client`,
  backed by Better Auth in the API). The session token lives in
  `localStorage`. Screens sign in, sign up, set passwords and sign out through
  `auth`, never through the provider directly.
- **`src/lib/use-me.ts`** wraps the shared `useMe` so `board` and `membership`
  describe the band picked in the header's band picker.

## Tests

```bash
npm test         # Jest
npm run lint
```
