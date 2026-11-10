# Environments: `APP_ENV` and `NODE_ENV`

Two settings decide how each app behaves, and they answer different questions.

- **`APP_ENV`** says *which deployment this is*: `development`, `staging` or
  `production`. It changes how the app reports on itself (logs, error tags,
  startup checks). It never changes what users can do.
- **`NODE_ENV`** says *whether the outside world is real*: only `production`
  sends real email and real push. It is `production` on staging too, so
  staging can be tested end to end.

Checked against the code on 2026-11-10. When one of the files named below
changes what it reads, this page changes in the same PR.

## The combinations we run

| Where | `APP_ENV` | `NODE_ENV` | What you get |
|---|---|---|---|
| Your Mac (`npm run dev`) | unset or `development` | unset | Readable logs, mail to Mailpit, no push, localhost fallbacks |
| Tests (`jest`) | unset | `test` (Jest sets it) | Mail and push go nowhere |
| Staging | `staging` | `production` | JSON logs, real mail and push, errors tagged `staging` |
| Production | `production` | `production` | Same as staging, errors tagged `production` |

Staging and production differ only in the `APP_ENV` tag and in the values of
the other variables (database, Resend key, domains). No code path treats them
differently.

## `APP_ENV`

Read through `parseAppEnv()` in `packages/shared/src/errors.ts`. Anything that
is not exactly `staging` or `production` (unset, a typo in the web or phone
variable) counts as `development`.

Each app has its own name for it, because web and phone variables are baked
into the bundle at build time:

| App | Variable | Where it is set |
|---|---|---|
| API | `APP_ENV` | `apps/api/.env`, or the host's variables |
| Web | `NEXT_PUBLIC_APP_ENV` | `apps/web/.env.local`, or the host's variables at build time |
| Phone | `EXPO_PUBLIC_APP_ENV` | Per build profile in `apps/mobile/eas.json`: `development` → `development`, `preview` → `staging`, `production` → `production` |

### What it changes in the API

| Behaviour | `development` | `staging` / `production` | Code |
|---|---|---|---|
| Log format | Coloured, human-readable | One JSON object per line | `src/main.ts` `createLogger()` |
| Default log level | `debug` and up | `log` and up | same; `LOG_LEVEL` overrides either |
| `WEB_URL` and `API_URL` | Optional, fall back to localhost | Required: the API refuses to start without them | `src/config/env.ts` `validateEnv()` |
| Sentry `environment` tag | `development` | `staging` or `production` | `src/instrument.ts` (only when `SENTRY_DSN` is set) |
| Reminder job check-in | Off: a closed laptop must not raise "missed check-in" alerts | The 5-minute reminder job checks in with a Sentry monitor (when `SENTRY_DSN` is set) | `src/notifications/reminder-due.job.ts` |

The API also rejects an `APP_ENV` that is set to anything other than the three
values: it fails at boot rather than guessing.

### What it changes in web and phone

Only the Sentry `environment` tag (`apps/web/src/instrumentation-client.ts`,
`apps/mobile/src/lib/sentry.ts`), and only when a Sentry DSN is set. Nothing
else in either app reads it.

## `NODE_ENV`

### What it changes in the API

The API never sets `NODE_ENV` itself. `npm run dev` leaves it unset, Jest sets
`test`, and a deployed host must set `production`.

| Behaviour | unset / `development` | `test` | `production` | Code |
|---|---|---|---|---|
| Email | Mailpit over SMTP (`SMTP_HOST`, `SMTP_PORT`, default `127.0.0.1:54325`); nothing reaches a real inbox | Dropped | Resend; `RESEND_API_KEY` and `MAIL_FROM` are required or the API fails to start | `src/notifications/notifications.module.ts` |
| Push | Dropped, unless `PUSH_IN_DEV=true` | Always dropped | Expo push, always | `src/notifications/push/push-transport.factory.ts` |
| Sign-in rate limiting | Off | Off | On (Better Auth's default) | Better Auth, configured in `src/auth/better-auth.ts` |

That covers every email the API sends: notifications, invites and sign-up
codes all leave through the same transport.

Better Auth also refuses to start under `production` with its built-in default
secret. We always pass `BETTER_AUTH_SECRET`, which `validateEnv()` requires
everywhere, so this never triggers.

### What it changes in web

Next.js sets `NODE_ENV` itself: `next dev` is `development`, and `next build`
and `next start` are `production`. Setting it by hand does nothing useful.

| Behaviour | `next dev` | Built site | Code |
|---|---|---|---|
| Missing `NEXT_PUBLIC_API_URL` | Falls back to `http://localhost:3001` | The build fails | `apps/web/src/lib/env.ts` |
| Unexpected errors | Also printed to the browser console | Sent to the reporter only | `apps/web/src/lib/report-error.ts` |
| Content security policy | Looser: allows `eval`, websockets and local http Storage, for hot reload | Strict, and upgrades http requests to https | `apps/web/next.config.ts`, `apps/web/security-headers.ts` |

### The phone app

The phone app does not read `NODE_ENV`. Its equivalent is React Native's
`__DEV__`, which is true when the bundle is served by Metro (a development
build) and false in preview and production builds.

| Behaviour | `__DEV__` true | `__DEV__` false | Code |
|---|---|---|---|
| API and Storage URLs left unset | Default to the machine serving Metro | The app throws at launch | `apps/mobile/src/lib/env.ts` |
| Unexpected errors | Also printed to the Metro console | Sent to the reporter only | `apps/mobile/src/lib/report-error.ts` |

## What neither setting controls

These look like environment behaviour but have their own switches, so a
staging or production deploy has to set each one:

| Behaviour | Switch |
|---|---|
| Error reporting on or off | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_SENTRY_DSN`: unset means off ([error-handling.md](error-handling.md)) |
| Where files are stored | `STORAGE_PROVIDER` (`supabase` or `r2`) ([storage.md](storage.md)) |
| Whether subscriptions are enforced | `BILLING_ENFORCED` ([billing.md](billing.md)) |
| RevenueCat's real store or Test Store | The key itself: a `test_` key uses the Test Store |
| Verifying Resend's webhooks | `RESEND_WEBHOOK_SECRET` ([notifications.md](notifications.md)) |

## Recipes

**Send a real email from your Mac.** Start the API with
`NODE_ENV=production`, a real `RESEND_API_KEY`, and `MAIL_FROM` on a domain
verified in Resend. Leave `APP_ENV` as `development` to keep readable logs.
Push also becomes real, and sign-in rate limiting turns on. Then
`MAIL_TEST_EMAIL=you@example.com npm run mail:test -w apps/api` queues one
test email through the whole pipeline. The address must belong to an account
that is already in a band.

**Get a push on a real phone from a local API.** Set `PUSH_IN_DEV=true` and
leave `NODE_ENV` alone. Mail still goes to Mailpit.

**Set up staging.** `APP_ENV=staging`, `NODE_ENV=production`, `WEB_URL`,
`API_URL`, and staging's own Resend key and sending domain. Build the web app
with `NEXT_PUBLIC_APP_ENV=staging`; the phone's `preview` profile already says
`staging`. See [release-workflow.md](release-workflow.md).
