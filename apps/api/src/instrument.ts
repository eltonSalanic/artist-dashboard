import * as Sentry from '@sentry/nestjs';
import { parseAppEnv } from '@artist/shared';
import { setErrorReporter } from './common/error-reporter';

/**
 * Error reporting. Imported first in main.ts so Sentry can hook Node before
 * anything else loads. Does nothing until SENTRY_DSN is set, so local dev and
 * tests never report.
 *
 * Only the exception filter's 500s and the background jobs' failures are
 * sent: expected 4xx errors stay in the logs. `environment` keeps staging and
 * production apart in one Sentry project.
 */
// This runs before ConfigModule has read .env, so a local dev run would never
// see SENTRY_DSN. Deployed hosts set real env vars and have no .env file.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env (deployed, or tests): the real environment is all there is.
}

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  const environment = parseAppEnv(process.env.APP_ENV);
  Sentry.init({
    dsn,
    environment,
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    // Errors only for now; tracing can be turned on once there's traffic to
    // look at, and it counts against the same free-plan quota.
    tracesSampleRate: 0,
    // Request bodies can hold personal data (notes, finances); only the
    // user id and request id set below are attached.
  });

  setErrorReporter((error, context) => {
    Sentry.withScope((scope) => {
      if (context.userId) scope.setUser({ id: context.userId });
      if (context.requestId) scope.setTag('requestId', context.requestId);
      scope.setContext('request', context);
      Sentry.captureException(error);
    });
  });
}
