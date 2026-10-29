import type { ComponentType } from 'react';
import { isReportedByServer } from '@artist/api-client';
import { auth } from './auth';
import { env } from './env';
import { setErrorReporter } from './report-error';

/**
 * Crash and error reporting, tracing, error replays and user feedback. Does
 * nothing until EXPO_PUBLIC_SENTRY_DSN is set.
 *
 * The SDK is required lazily, inside the `if`: its native half only exists in
 * builds made after the `@sentry/react-native` config plugin was added, and an
 * older dev build with no DSN must keep launching without touching it.
 *
 * `release` and `dist` are left to the SDK, which reads the app's version and
 * build number from the native bundle; that is what EAS source-map uploads
 * are tagged with, so the two always match.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

type SentryModule = typeof import('@sentry/react-native');
let sentry: SentryModule | null = null;

if (dsn) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/react-native') as SentryModule;
  sentry = Sentry;
  Sentry.init({
    dsn,
    environment: env.appEnv,
    integrations: [
      Sentry.reactNativeTracingIntegration(),
      // Masked by default: a replay shows layout and taps, not band data.
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
        maskAllVectors: true,
      }),
      Sentry.feedbackIntegration(),
    ],
    // App starts, screen loads and API calls; small traffic fits the free plan.
    tracesSampleRate: 1.0,
    // Mobile attaches trace headers to every request by default; only our
    // API should get them.
    tracePropagationTargets: [env.apiUrl],
    // Replays only for sessions that hit an error: the free plan has 50.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
  });

  // Who was affected, by id only: no email or name leaves the phone.
  auth.onSessionChange((session) =>
    Sentry.setUser(session ? { id: session.userId } : null),
  );

  setErrorReporter((error, context) => {
    if (isReportedByServer(error)) return;
    Sentry.withScope((scope) => {
      if (context) scope.setContext('details', context);
      Sentry.captureException(error);
    });
  });
}

/**
 * `Sentry.wrap` for the root layout: touch breadcrumbs, app-start timing and
 * the feedback widget. The component as-is when Sentry is off.
 */
export function withSentry(
  Root: ComponentType<Record<string, unknown>>,
): ComponentType<Record<string, unknown>> {
  return sentry ? sentry.wrap(Root) : Root;
}

/** Opens Sentry's "Report a problem" form, linked to recent errors. */
export function showFeedback(): void {
  sentry?.showFeedbackWidget();
}

/** Whether there is anywhere to send feedback to. */
export const feedbackAvailable = sentry !== null;
