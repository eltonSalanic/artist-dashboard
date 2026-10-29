import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, emailOTP } from 'better-auth/plugins';
import type { PrismaClient } from '../../generated/prisma/client';
import { AUTH_BASE_PATH } from './auth.tokens';
import { verifyAnyPassword } from './password';

/** A session lasts this long and slides forward while it's used. */
const SESSION_DAYS = 30;

/** Invite codes, like Supabase's before them, last an hour and work once. */
export const INVITE_CODE_TTL_SECONDS = 60 * 60;

export interface AuthOptions {
  prisma: PrismaClient;
  secret: string;
  /** The API's public origin; Better Auth builds its own URLs from it. */
  baseURL: string;
  /** Origins allowed to call the auth routes from a browser. */
  trustedOrigins: string[];
  /** Mails the 6-digit invite code. Called for `sign-in` codes only. */
  sendInviteCode(email: string, code: string): Promise<void>;
}

/**
 * The one place that configures Better Auth. Users and sessions live in our
 * Postgres (the Auth* Prisma models); the apps hold an opaque session token
 * and send it as `Authorization: Bearer …` (the `bearer` plugin), because the
 * web app and the API sit on different sites and cookies would be third-party.
 *
 * Invites use the email-code plugin: `InviteMailer` asks for a `sign-in` code,
 * and signing in with it creates the account if there isn't one yet.
 */
export function createAuth(options: AuthOptions) {
  return betterAuth({
    database: prismaAdapter(options.prisma, { provider: 'postgresql' }),
    secret: options.secret,
    baseURL: options.baseURL,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: options.trustedOrigins,
    user: { modelName: 'authUser' },
    session: {
      modelName: 'authSession',
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    account: { modelName: 'authAccount' },
    verification: { modelName: 'authVerification' },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      password: { verify: verifyAnyPassword },
    },
    advanced: {
      // AuthUser.id doubles as User.id, which is a Postgres uuid.
      database: { generateId: () => randomUUID() },
    },
    plugins: [
      bearer(),
      emailOTP({
        otpLength: 6,
        expiresIn: INVITE_CODE_TTL_SECONDS,
        allowedAttempts: 3,
        async sendVerificationOTP({ email, otp, type }) {
          if (type === 'sign-in') await options.sendInviteCode(email, otp);
        },
      }),
    ],
  });
}
