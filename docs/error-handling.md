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

Off until a DSN is set: `SENTRY_DSN` (API), `NEXT_PUBLIC_SENTRY_DSN` (web), `EXPO_PUBLIC_SENTRY_DSN` (mobile). Every event is tagged with the environment.

- Reported: API 500s, background job failures, render crashes, and unexpected client errors (bugs and 5xx) via each app's `reportError`.
- Not reported: offline users, validation and other expected 4xx.
- Mobile needs a new native build (the `@sentry/react-native` config plugin) before setting the DSN. The SDK loads lazily, so older dev builds keep working without it.
- One Sentry project can serve all three apps on the free plan (5,000 errors a month, shared between staging and prod).
