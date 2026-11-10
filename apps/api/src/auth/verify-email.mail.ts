import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAIL_TRANSPORT,
  type MailTransport,
  type OutgoingMail,
} from '../notifications/mail/mail-transport';
import { esc } from '../notifications/templates/layout';

/**
 * Sends the 6-digit code that confirms a new account's email, when Better
 * Auth asks for an `email-verification` code (on sign-up, on signing in
 * unconfirmed, or on "Send a new code").
 *
 * The resend route is public, and Better Auth already skips addresses with no
 * account. We also skip accounts that are already confirmed, so the route
 * can't be used to mail codes to people who never asked for one.
 */
@Injectable()
export class VerifyEmailMail {
  private readonly logger = new Logger(VerifyEmailMail.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {}

  async send(email: string, code: string): Promise<void> {
    const user = await this.prisma.authUser.findUnique({
      where: { email: email.toLowerCase() },
      select: { emailVerified: true },
    });
    if (!user || user.emailVerified) {
      this.logger.debug(`${email} needs no confirming; code not mailed`);
      return;
    }
    await this.transport.send(renderVerifyEmailMail({ to: email, code }));
  }
}

export interface VerifyEmailMailInput {
  to: string;
  code: string;
}

const INK = '#2b2724';
const MUTED = '#6f6862';
const CREAM = '#faf6f0';

/** Just the code, big enough to read off one screen and type on another. */
export function renderVerifyEmailMail(input: VerifyEmailMailInput): OutgoingMail {
  const subject = `${input.code} is your Band Wall code`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK}">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">Confirm your email</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Enter this code in Band Wall to finish setting up your account:</p>
    <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:6px">${esc(input.code)}</p>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">The code works once and expires in an hour. If you didn't sign up for Band Wall, you can ignore this email.</p>
  </div>
</body></html>`;
  const text = [
    `Your Band Wall code is ${input.code}`,
    '',
    'Enter it in Band Wall to finish setting up your account. It works once and expires in an hour.',
    '',
    "If you didn't sign up for Band Wall, you can ignore this email.",
  ].join('\n');

  return {
    to: input.to,
    subject,
    html,
    text,
    idempotencyKey: `verify-email:${input.to}:${input.code}`,
  };
}
