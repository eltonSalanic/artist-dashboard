// Must stay first: error reporting hooks Node before the app loads.
import './instrument';

import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { AUTH_BASE_PATH, BETTER_AUTH, type Auth } from './auth/auth.tokens';
import { createLogger } from './config/logger';

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
    dropCookies,
    toNodeHandler(app.get<Auth>(BETTER_AUTH)),
  );
  await app.listen(process.env.PORT ?? 3001);
}
/**
 * The apps authenticate with a bearer token only. iOS's networking layer
 * still keeps the session cookie Better Auth sets on a response and sends it
 * back, and Better Auth treats any request carrying a cookie as a browser
 * form that needs an Origin header (CSRF protection), which a phone has none
 * of: sign-in then fails with MISSING_OR_NULL_ORIGIN. A cookie is never how
 * we authenticate, so it never reaches Better Auth.
 */
function dropCookies(req: Request, _res: Response, next: NextFunction) {
  delete req.headers.cookie;
  next();
}

void bootstrap();
