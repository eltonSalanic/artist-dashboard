// Must stay first: error reporting hooks Node before the app loads.
import './instrument';

import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseAppEnv } from '@artist/shared';
import { AppModule } from './app.module';
import { logLevelsFrom, type LogLevelSetting } from './config/env';

/**
 * Dev: coloured, human-readable, debug and up. Staging and production: one
 * JSON object per line at "log" and up, which Railway's log viewer can filter
 * by field (requestId, userId, status). LOG_LEVEL overrides either default,
 * e.g. LOG_LEVEL=debug on staging while chasing something.
 */
function createLogger(): ConsoleLogger {
  const deployed = parseAppEnv(process.env.APP_ENV) !== 'development';
  const level = (process.env.LOG_LEVEL ||
    (deployed ? 'log' : 'debug')) as LogLevelSetting;
  return new ConsoleLogger({
    json: deployed,
    colors: !deployed,
    // One line per entry in dev too, so request lines don't sprawl.
    breakLength: Infinity,
    compact: true,
    logLevels: logLevelsFrom(level),
  });
}

async function bootstrap() {
  // Resend's webhook signature covers the exact bytes received, and
  // body-parser's parse-then-restringify is not byte-identical.
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: createLogger(),
  });
  // Flushes queued Sentry events (and closes Prisma) on SIGTERM, so the error
  // that preceded a redeploy isn't lost with the process.
  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    // Lets the web app read the id to show or report alongside an error.
    exposedHeaders: ['x-request-id'],
  });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
