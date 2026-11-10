import { ConsoleLogger } from '@nestjs/common';
import { parseAppEnv } from '@artist/shared';
import {
  InvalidEnvironmentError,
  logLevelsFrom,
  type LogLevelSetting,
} from './env';

export type LogFormat = 'pretty' | 'json';

/**
 * How log lines look. JSON on the deployed hosts, where Railway's log viewer
 * filters by field (requestId, userId, status); coloured, readable lines
 * everywhere else, including a local run with APP_ENV=staging. Tied to where
 * the API runs rather than to APP_ENV, because pointing a laptop at staging
 * shouldn't turn the terminal into a wall of JSON. LOG_FORMAT overrides.
 */
export function logFormatFrom(env: NodeJS.ProcessEnv): LogFormat {
  if (env.LOG_FORMAT === 'json' || env.LOG_FORMAT === 'pretty') {
    return env.LOG_FORMAT;
  }
  return env.RAILWAY_PROJECT_ID ? 'json' : 'pretty';
}

/**
 * Nest's ConsoleLogger, except that a bad environment at boot is printed as
 * its list of problems alone: the stack trace only points into the bundle,
 * and in JSON it buried the list in one escaped line.
 */
class AppLogger extends ConsoleLogger {
  error(message: unknown, ...rest: unknown[]) {
    if (message instanceof InvalidEnvironmentError) {
      super.error(message.message, ...rest);
      return;
    }
    super.error(message, ...rest);
  }
}

/**
 * Level: debug and up in development, "log" and up on staging and production.
 * LOG_LEVEL overrides either default, e.g. LOG_LEVEL=debug on staging while
 * chasing something.
 */
export function createLogger(
  env: NodeJS.ProcessEnv = process.env,
): ConsoleLogger {
  const deployed = parseAppEnv(env.APP_ENV) !== 'development';
  const level = (env.LOG_LEVEL ||
    (deployed ? 'log' : 'debug')) as LogLevelSetting;
  const json = logFormatFrom(env) === 'json';
  return new AppLogger({
    json,
    colors: !json,
    // One line per entry in dev too, so request lines don't sprawl.
    breakLength: Infinity,
    compact: true,
    logLevels: logLevelsFrom(level),
  });
}
