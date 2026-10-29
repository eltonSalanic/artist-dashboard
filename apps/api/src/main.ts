// Must stay first: error reporting hooks Node before the app loads.
import './instrument';

import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import { parseAppEnv } from '@artist/shared';
import { AppModule } from './app.module';
import { AUTH_BASE_PATH, BETTER_AUTH, type Auth } from './auth/auth.tokens';
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
    // x-request-id: the web app shows or reports it alongside an error.
    // set-auth-token: where Better Auth hands back the session token.
    exposedHeaders: ['x-request-id', 'set-auth-token'],
  });
  // Better Auth answers its own routes (sign-in, sign-up, invite codes) as
  // plain Express middleware, ahead of Nest's guards: they are how a caller
  // gets a session in the first place.
  app.use(
    `${AUTH_BASE_PATH}/*splat`,
    toNodeHandler(app.get<Auth>(BETTER_AUTH)),
  );
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
