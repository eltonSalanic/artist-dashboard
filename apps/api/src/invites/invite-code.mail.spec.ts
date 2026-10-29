import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import type {
  MailTransport,
  OutgoingMail,
} from '../notifications/mail/mail-transport';
import { InviteCodeMail, renderInviteMail } from './invite-code.mail';

describe('InviteCodeMail', () => {
  const prisma = { invite: { findFirst: jest.fn() } };
  const config = { get: jest.fn().mockReturnValue('https://bandwall.app') };
  const send = jest.fn<Promise<void>, [OutgoingMail]>();
  const transport: MailTransport = { send };
  const mail = new InviteCodeMail(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    transport,
  );

  beforeEach(() => jest.clearAllMocks());

  it('mails a code only to someone with a pending invite', async () => {
    prisma.invite.findFirst.mockResolvedValue(null);
    await mail.send('stranger@x.com', '123456');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the link and the code for a pending invite', async () => {
    prisma.invite.findFirst.mockResolvedValue({
      board: { name: 'Neon Harbor' },
      invitedBy: { displayName: 'Jordan' },
    });
    await mail.send('Mia@Band.com', '654321');
    const sent = send.mock.calls[0][0];
    expect(prisma.invite.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'mia@band.com', status: 'PENDING' },
      }),
    );
    expect(sent.subject).toBe('Jordan invited you to Neon Harbor on Band Wall');
    expect(sent.text).toContain(
      'https://bandwall.app/auth/callback?email=Mia%40Band.com&code=654321',
    );
    expect(sent.html).toContain('654321');
    expect(sent.unsubscribePostUrl).toBeUndefined();
  });
});

describe('renderInviteMail', () => {
  it('escapes names in the HTML', () => {
    const mail = renderInviteMail({
      to: 'a@b.c',
      code: '111111',
      boardName: '<script>',
      inviterName: 'Sam & Co',
      acceptUrl: 'https://x/auth/callback',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('Sam &amp; Co');
  });
});
