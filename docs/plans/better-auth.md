# Better Auth

> **State:** Testing
> **Updated:** 2026-10-29
> **Task ID prefix:** `AUTH`
> **Source:** New

## Goal

Run sign-in ourselves instead of through Supabase Auth. Better Auth runs inside
the NestJS API and keeps users and sessions in our own Postgres, managed by
Prisma like every other table. Bands notice nothing: email and password, the
invite email with a link for the web and a 6-digit code for the phone, and
staying signed in all work as they do today.

Supabase stays for the database and file storage.

## Scope and decisions

- **In scope:**
  - Better Auth in the API.
  - The invite email and code.
  - New `AuthClient` versions for web and phone.
  - Removing Supabase Auth from the code, env and docs.
- **Out of scope:**
  - Forgot-password. The app has none today. It would be a small follow-up on
    the same email-code plugin.
  - Google and Apple sign-in.
  - Two-factor sign-in.
- **Decisions:**
  - **Library, not service.** We use `better-auth` mounted in Express at
    `/api/auth/*`, ahead of Nest's body parser. We don't use the community
    `@thallesp/nestjs-better-auth` module: it would need `bodyParser: false` for
    the whole app, which breaks the raw body that the Resend webhook signature
    check relies on.
  - **Bearer tokens, not cookies.** Web is on Vercel and the API is on
    Railway, so cookies would be cross-site. Web and phone send
    `Authorization: Bearer <session token>` (Better Auth's `bearer()` plugin).
    The token is stored in `localStorage` on web and in the keychain on the
    phone, reusing the existing chunked SecureStore adapter.
  - **No auth client library in the apps.** Each app's `AuthClient` calls the
    `/api/auth` endpoints with `apiFetch`-style requests. The screens stay as
    they are, and `@supabase/supabase-js` leaves both apps.
  - **Sessions:**
    - A session lasts 30 days and slides forward on use, using Better Auth's
      `expiresIn` and `updateAge`.
    - There's no token refresh, so `startAutoRefresh` and `stopAutoRefresh`
      do nothing.
    - The API checks each request with `auth.api.getSession()`, which is one
      indexed lookup.
  - **Separate auth tables.** The tables are `AuthUser`, `AuthSession`,
    `AuthAccount` and `AuthVerification`, kept apart from the app's `User`. Ids
    are UUIDs, and `AuthUser.id` = `User.id`. This is the same seam as before,
    so `POST /me/bootstrap` and every relation keep working unchanged.
  - **Invites use the email-code plugin.**
    - `InvitesService` asks Better Auth for a `sign-in` code for the invited
      email.
    - Our `sendVerificationOTP` mails the invite. It contains a link,
      `WEB_URL/auth/callback?email=…&code=…`, and the same code for the phone.
    - The mail goes out through the existing `MailTransport`: Mailpit in
      development, Resend in production.
    - Codes last 1 hour (Supabase's was also 1 hour) and allow 3 wrong tries.
    - Signing in with the code creates the account if needed. Then
      `POST /me/password` sets a password through `auth.api.setPassword`.
  - **Email confirmation stays off**, matching the local Supabase setup.

## Tasks

| ID | Task | State | Trello card |
|---|---|---|---|
| AUTH-001 | API: Better Auth with Prisma tables, bearer sessions, `/api/auth` mount, new auth guard | Testing | [AUTH-001](https://trello.com/c/T6d5pC9W) |
| AUTH-002 | API: invite email with code through `MailTransport`; `POST /me/password` | Testing | [AUTH-002](https://trello.com/c/hwhON5yr) |
| AUTH-003 | Web: Better Auth `AuthClient`, invite link signs in with the code | Testing | [AUTH-003](https://trello.com/c/UX65R3iR) |
| AUTH-004 | Phone: Better Auth `AuthClient` with keychain token | Testing | [AUTH-004](https://trello.com/c/jogq4CPS) |
| AUTH-005 | Remove Supabase Auth: deps, env, config, docs; reset local auth data | Testing | [AUTH-005](https://trello.com/c/nVsHucSY) |
| AUTH-006 | Tests and feature test | Testing | [AUTH-006](https://trello.com/c/Gpj8Gmi4) |

## Verification

- [ ] Web: sign up, sign in, wrong password, sign out (header and no-band screen)
- [ ] Web: invite email in Mailpit → link → set password → on the band
- [ ] Phone: invite code + password → on the band; password then works on web
- [ ] Phone: sign in, restart app, background for a while → still signed in
- [ ] Revoked session (sign out everywhere) → next request lands on sign-in with "session expired"
- [ ] API: request with no token or a bad token → 401; `@Public()` routes still open
- [ ] No `supabase.auth`, `SUPABASE_JWT_SECRET` or `SUPABASE_ANON_KEY` left in code or env examples

## Notes and decisions

- 2026-10-29: Supabase accounts are imported, passwords included (Elton's
  request after the merge). Migration `import_supabase_users` copies
  `auth.users` into `AuthUser`/`AuthAccount` with the same ids and the bcrypt
  hashes, and `src/auth/password.ts` verifies `$2…` hashes with bcrypt and
  everything else with Better Auth's scrypt. It only runs where `auth.users`
  exists, and skips accounts already in Better Auth. Bootstrap's adoption of
  orphaned `User` rows stays as a fallback for any account the import missed.

- 2026-10-29: started after the `AuthClient` seam (`feat/auth-client`, merged in
  `7279ee3`). Elton confirmed only local test users exist, so no migration.
- 2026-10-29: feature test on web and the iOS simulator, 16 checks (report:
  https://claude.ai/artifact/F2XysRLHBaV6oejtS34dhk). One bug fixed in
  `58e44f3`: iOS resent Better Auth's session cookie, and Better Auth refused a
  cookie with no Origin header. Sessions are bearer-only, so the API drops
  cookies before Better Auth.
