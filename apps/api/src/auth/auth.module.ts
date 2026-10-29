import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InviteCodeMail } from '../invites/invite-code.mail';
import { createAuth } from './better-auth';
import { BETTER_AUTH } from './auth.tokens';

/**
 * Global so the guard, the invite mailer and `main.ts` (which mounts the auth
 * routes) all reach the same instance.
 */
@Global()
@Module({
  providers: [
    InviteCodeMail,
    {
      provide: BETTER_AUTH,
      inject: [PrismaService, ConfigService, InviteCodeMail],
      useFactory: (
        prisma: PrismaService,
        config: ConfigService,
        inviteMail: InviteCodeMail,
      ) => {
        const webUrl = config.get<string>('WEB_URL') ?? 'http://localhost:3000';
        return createAuth({
          prisma,
          secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
          baseURL: config.get<string>('API_URL') ?? 'http://localhost:3001',
          trustedOrigins: [webUrl],
          sendInviteCode: (email, code) => inviteMail.send(email, code),
        });
      },
    },
  ],
  exports: [BETTER_AUTH],
})
export class AuthModule {}
