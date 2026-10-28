import { env } from './env';
import { setErrorReporter } from './report-error';

/**
 * Crash and error reporting. Does nothing until EXPO_PUBLIC_SENTRY_DSN is set.
 *
 * The SDK is required lazily, inside the `if`: its native half only exists in
 * builds made after the `@sentry/react-native` config plugin was added, and an
 * older dev build with no DSN must keep launching without touching it.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
  Sentry.init({
    dsn,
    environment: env.appEnv,
    // Errors and native crashes only; tracing counts against the same quota.
    tracesSampleRate: 0,
  });

  setErrorReporter((error, context) => {
    Sentry.withScope((scope) => {
      if (context) scope.setContext('details', context);
      Sentry.captureException(error);
    });
  });
}
