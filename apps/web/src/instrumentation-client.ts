import * as Sentry from "@sentry/react";
import { isReportedByServer } from "@artist/api-client";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { setErrorReporter } from "@/lib/report-error";

/**
 * Error reporting, tracing and error replays for the browser. Runs before the
 * app is interactive, so crashes during the first render are caught too. Does
 * nothing until NEXT_PUBLIC_SENTRY_DSN is set, so local dev never reports.
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
    // Vercel exposes the deploy's commit; ties each issue to the release
    // that introduced it, and source maps to the right build.
    release:
      process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    integrations: [
      Sentry.browserTracingIntegration(),
      // Text and media are masked: a replay shows the shape of the page and
      // what was clicked, never a band's notes or finances.
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    // Page loads and navigations; small traffic fits the free plan's spans.
    tracesSampleRate: 1.0,
    // Continue the trace into our API (only), so a slow or failed page links
    // to the request behind it.
    tracePropagationTargets: [env.apiUrl],
    // Replays only for sessions that hit an error: the free plan has 50.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Noise from browser extensions and stale tabs after a deploy.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      /ChunkLoadError/,
      /Loading chunk \d+ failed/,
      /^Script error\.?$/,
    ],
    denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
    dataCollection: { httpBodies: [], cookies: false },
  });

  // Who was affected, by id only: no email or name leaves the app.
  auth.onSessionChange((session) =>
    Sentry.setUser(session ? { id: session.userId } : null),
  );

  setErrorReporter((error, context) => {
    if (isReportedByServer(error)) return;
    Sentry.withScope((scope) => {
      if (context) scope.setContext("details", context);
      Sentry.captureException(error);
    });
  });
}
