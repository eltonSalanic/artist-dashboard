import * as Sentry from "@sentry/react";
import { env } from "@/lib/env";
import { setErrorReporter } from "@/lib/report-error";

/**
 * Error reporting for the browser. Runs before the app is interactive, so
 * crashes during the first render are caught too. Does nothing until
 * NEXT_PUBLIC_SENTRY_DSN is set, so local dev never reports.
 *
 * Sentry's own global handlers catch uncaught errors and unhandled
 * rejections; `reportError` (error boundaries, failed queries and mutations)
 * sends the ones React and React Query would otherwise swallow.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: env.appEnv,
    // Errors only; tracing and replays cost quota and aren't needed yet.
    tracesSampleRate: 0,
  });

  setErrorReporter((error, context) => {
    Sentry.withScope((scope) => {
      if (context) scope.setContext("details", context);
      Sentry.captureException(error);
    });
  });
}
