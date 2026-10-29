# Error handling and logging

Status: built on `feat/error-handling` (Oct 2026). Sentry is wired but off until DSNs are set.

How failures reach users, logs and error reports, in all three apps.

## One error shape

Every API error response is an `ApiErrorBody` (`packages/shared/src/errors.ts`):
`statusCode`, a user-safe `message`, an optional `code`, field `issues` for validation, and the `requestId`.

- `apps/api/src/common/all-exceptions.filter.ts` produces it for every error. Prisma `P2002` maps to 409 and `P2025` to 404. Anything unexpected becomes a 500 with "Internal server error", logged with its stack and sent to the reporter.
- The raw Prisma, Supabase or stack text never reaches a client.

## What users see

All copy comes from `toUserMessage(error, fallback)` in `packages/api-client/src/messages.ts`. Hooks, inline errors and alerts never show `error.message` directly.

| Failure | User sees |
|---|---|
| Offline / API unreachable (`NetworkError`) | "Can't reach Band Wall. Check your connection and try again." |
| Validation (400 with `issues`) | The first field problem, e.g. "Title: Required" |
| Session gone (401) | Signed out, then "Your session expired. Please sign in again." |
| 403 / 404 with only Nest's default text | "You don't have permission…" / "That item no longer exists…" |
| 5xx | "Something went wrong on our end. Try again in a moment." |
| A specific API message ("That person is already a board member") | That message |
| Supabase Auth errors | `authErrorMessage()`, mapped by Supabase error code |

Safety nets:

- **Web:** `app/(app)/error.tsx`, `app/global-error.tsx` and `app/not-found.tsx`. A failed first load of any query shows one "Couldn't load…" toast with Retry, so empty-looking screens no longer hide failures. The dashboard, the app shell and the detail modals have their own retryable error states.
- **Mobile:** `ErrorBoundary` exported from the root and tabs layouts (`components/crash-screen.tsx`). The launch screen has Try again and Sign out. Alerts use the friendly message as their title.

## Environments

`APP_ENV` (`development` | `staging` | `production`) is separate from `NODE_ENV`, because staging runs with `NODE_ENV=production` so real mail and push work.

| | API | Web | Mobile |
|---|---|---|---|
| Variable | `APP_ENV` | `NEXT_PUBLIC_APP_ENV` | `EXPO_PUBLIC_APP_ENV` (set per profile in `eas.json`) |
| Logs | Dev: readable, debug and up. Staging/prod: JSON, `log` and up. `LOG_LEVEL` overrides. | Dev console only | Dev Metro only |
| Startup checks | `config/env.ts` refuses to boot without required vars; `WEB_URL`/`API_URL` are required outside dev | Production build fails without `NEXT_PUBLIC_API_URL` | `lib/env.ts` throws on missing vars |

Every API request gets an `x-request-id` (kept from a proxy, or minted). It is returned as a header and in error bodies, and each request logs one line with method, path, status, duration, user id and request id. Emails and push tokens are masked in logs (`common/redact.ts`).

## Error reporting (Sentry)

Org `elton-salanic`, one project per app: `band-wall-api`, `band-wall-web`, `band-wall-mobile`. Off until a DSN is set: `SENTRY_DSN` (API), `NEXT_PUBLIC_SENTRY_DSN` (web), `EXPO_PUBLIC_SENTRY_DSN` (mobile). Every event is tagged with the environment.

- **Reported:** API 500s and background-job failures (by the API), render crashes and unexpected client bugs (by web and mobile `reportError`). Web and mobile skip 5xx responses, because the API already reported them (`isReportedByServer`).
- **Not reported:** offline users, validation and other expected 4xx.
- **Who and which release:** events carry the user id only (no email or name). The API's release is the Railway commit, the web's the Vercel commit, and mobile's the app version + build.
- **Privacy:** the API sends no request bodies, cookies or auto-collected user info (`dataCollection` in `instrument.ts`). Replays mask all text and media.
- **Tracing:** on in all three apps at full sampling (fine for the free plan's 5M spans at current traffic). A web page load and its API calls share one trace. `/health` is excluded.
- **Replays:** web and mobile record only sessions that hit an error (free plan: 50 a month).
- **Cron monitor:** the 5-minute reminder job checks in as `reminder-due` from staging and production only, so a missed or failing run raises an issue. The 10-second dispatcher isn't monitored (too frequent).
- **Feedback:** the phone's You tab has "Report a problem", which opens Sentry's form linked to recent errors.
- **Alerts:** each project has Sentry's default "high priority issues" email alert.
- **Mobile** needs a native build made after the `@sentry/react-native` plugin was added. The SDK loads lazily, so older dev builds keep working without it. The SDK is 7.11 (pinned by Expo SDK 57); 8.x features come with the next Expo SDK.
- **Free plan:** 1 user, 5,000 errors a month, shared between staging and prod.
- **Not done yet:** source maps and DSNs for staging and production (Trello: "Sentry in staging & prod: keys and readable stack traces").
