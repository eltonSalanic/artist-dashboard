import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InviteCodeMail } from '../invites/invite-code.mail';
import { createAuth } from './better-auth';
import { VerifyEmailMail } from './verify-email.mail';
import { BETTER_AUTH } from './auth.tokens';

/**
 * Global so the guard, the invite mailer and `main.ts` (which mounts the auth
 * routes) all reach the same instance.
 */
@Global()
@Module({
  providers: [
    InviteCodeMail,
    VerifyEmailMail,
    {
      provide: BETTER_AUTH,
      inject: [PrismaService, ConfigService, InviteCodeMail, VerifyEmailMail],
      useFactory: (
        prisma: PrismaService,
        config: ConfigService,
        inviteMail: InviteCodeMail,
        verifyMail: VerifyEmailMail,
      ) => {
        const webUrl = config.get<string>('WEB_URL') ?? 'http://localhost:3000';
        return createAuth({
          prisma,
          secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
          baseURL: config.get<string>('API_URL') ?? 'http://localhost:3001',
          trustedOrigins: [webUrl],
          sendInviteCode: (email, code) => inviteMail.send(email, code),
          sendVerifyEmailCode: (email, code) => verifyMail.send(email, code),
          apple: {
            bundleId: config.get<string>('APPLE_BUNDLE_ID') ?? 'com.bandwall.app',
            serviceId: config.get<string>('APPLE_SERVICE_ID') || undefined,
          },
          google: { clientIds: splitList(config.get<string>('GOOGLE_CLIENT_IDS')) },
        });
      },
    },
  ],
  exports: [BETTER_AUTH],
})
export class AuthModule {}

/** A comma-separated env var as a list, blanks dropped. */
function splitList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
