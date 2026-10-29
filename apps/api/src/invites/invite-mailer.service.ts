import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BETTER_AUTH, type Auth } from '../auth/auth.tokens';

/**
 * Starts the invite email. Kept apart from InvitesService so the domain logic
 * stays mockable without Better Auth in a unit test.
 */
@Injectable()
export class InviteMailer {
  private readonly logger = new Logger(InviteMailer.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BETTER_AUTH) private readonly auth: Auth,
  ) {}

  /**
   * Mails a 6-digit code (and a link carrying it) to someone with no account.
   * Returns 'already_registered' for an existing account instead: not an
   * error for our flow, since the pending Invite row is matched by email the
   * next time they sign in.
   */
  async inviteByEmail(email: string): Promise<'sent' | 'already_registered'> {
    const existing = await this.prisma.authUser.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) return 'already_registered';

    // Better Auth creates and stores the code, then calls InviteCodeMail.
    try {
      await this.auth.api.sendVerificationOTP({
        body: { email, type: 'sign-in' },
      });
    } catch (error) {
      // Rate limits and mail failures would otherwise be a bare 500. Log the
      // cause (no address: it's personal data) and tell the admin instead.
      this.logger.error(
        `Invite email failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        {
          message:
            "Couldn't send the invite email. Try again in a few minutes.",
          code: 'INVITE_EMAIL_FAILED',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    return 'sent';
  }
}
