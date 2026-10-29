import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAIL_TRANSPORT,
  type MailTransport,
  type OutgoingMail,
} from '../notifications/mail/mail-transport';
import { esc } from '../notifications/templates/layout';

/**
 * Sends the invite email when Better Auth hands us a 6-digit sign-in code.
 *
 * The code route is public (the phone's "Join with your code" needs it), so
 * anyone could ask for a code for any address. We only mail people with a
 * pending invite: for everyone else this is a silent no-op, which keeps the
 * route from becoming a way to spam strangers.
 */
@Injectable()
export class InviteCodeMail {
  private readonly logger = new Logger(InviteCodeMail.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
  ) {}

  async send(email: string, code: string): Promise<void> {
    const invite = await this.prisma.invite.findFirst({
      where: { email: email.toLowerCase(), status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: {
        board: { select: { name: true } },
        invitedBy: { select: { displayName: true } },
      },
    });
    if (!invite) {
      this.logger.debug(`No pending invite for ${email}; code not mailed`);
      return;
    }

    const webUrl =
      this.config.get<string>('WEB_URL') ?? 'http://localhost:3000';
    await this.transport.send(
      renderInviteMail({
        to: email,
        code,
        boardName: invite.board.name,
        inviterName: invite.invitedBy.displayName,
        acceptUrl: `${webUrl}/auth/callback?${new URLSearchParams({ email, code })}`,
      }),
    );
  }
}

export interface InviteMailInput {
  to: string;
  code: string;
  boardName: string;
  inviterName: string;
  acceptUrl: string;
}

const CORAL = '#e2624a';
const INK = '#2b2724';
const MUTED = '#6f6862';
const CREAM = '#faf6f0';

/** The invite: a link for the web and the same code typed on the phone. */
export function renderInviteMail(input: InviteMailInput): OutgoingMail {
  const subject = `${input.inviterName} invited you to ${input.boardName} on Band Wall`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK}">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED}">${esc(input.boardName)}</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">You're invited to Band Wall</h1>
    <div style="font-size:15px;line-height:1.6">
      <p style="margin:0 0 12px">${esc(input.inviterName)} added you to ${esc(input.boardName)}: shows, rehearsals, to-dos and notes in one place.</p>
    </div>
    <p style="margin:24px 0 0"><a href="${esc(input.acceptUrl)}" style="display:inline-block;background:${CORAL};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Accept the invite on the web</a></p>
    <p style="margin:28px 0 8px;font-size:15px;line-height:1.6">On your phone? Open the Band Wall app, tap <strong>Invited to a band? Join with your code</strong>, and enter:</p>
    <p style="margin:0;font-size:28px;font-weight:700;letter-spacing:6px">${esc(input.code)}</p>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:${MUTED}">The link and the code work once and expire in an hour. If they have expired, ask your band admin to invite you again.</p>
  </div>
</body></html>`;
  const text = [
    `${input.inviterName} added you to ${input.boardName} on Band Wall.`,
    '',
    `Accept the invite on the web: ${input.acceptUrl}`,
    '',
    `On your phone? Open the Band Wall app, tap "Invited to a band? Join with your code", and enter: ${input.code}`,
    '',
    'The link and the code work once and expire in an hour. If they have expired, ask your band admin to invite you again.',
  ].join('\n');

  return {
    to: input.to,
    subject,
    html,
    text,
    idempotencyKey: `invite-code:${input.to}:${input.code}`,
  };
}
