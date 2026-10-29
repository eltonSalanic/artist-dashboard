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
 *
 * Tracing is on: every request, Prisma query and outgoing call becomes a span,
 * and a trace started in the web app continues here. Health checks are left
 * out, since the host polls them every few seconds.
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
    integrations: [Sentry.prismaIntegration()],
    // Small traffic fits the free plan's 5M spans at full sampling. Lower the
    // default once real usage makes the quota a concern.
    tracesSampler: ({ name, inheritOrSampleWith }) =>
      /\/health\b/.test(name) ? 0 : inheritOrSampleWith(1.0),
    // The SDK attaches request bodies, cookies and user details by default.
    // Bodies here hold notes and finance entries, so none of that is sent:
    // errors carry only the user id and request id set below.
    dataCollection: {
      httpBodies: [],
      cookies: false,
      userInfo: false,
    },
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
