import type { PrismaService } from '../prisma/prisma.service';
import type {
  MailTransport,
  OutgoingMail,
} from '../notifications/mail/mail-transport';
import { VerifyEmailMail, renderVerifyEmailMail } from './verify-email.mail';

describe('VerifyEmailMail', () => {
  const prisma = { authUser: { findUnique: jest.fn() } };
  const send = jest.fn<Promise<void>, [OutgoingMail]>();
  const transport: MailTransport = { send };
  const mail = new VerifyEmailMail(
    prisma as unknown as PrismaService,
    transport,
  );

  beforeEach(() => jest.clearAllMocks());

  it('mails the code to an unconfirmed account', async () => {
    prisma.authUser.findUnique.mockResolvedValue({ emailVerified: false });
    await mail.send('Mia@Band.com', '654321');
    expect(prisma.authUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'mia@band.com' } }),
    );
    const sent = send.mock.calls[0][0];
    expect(sent.to).toBe('Mia@Band.com');
    expect(sent.subject).toBe('654321 is your Band Wall code');
    expect(sent.text).toContain('654321');
  });

  it('skips an address with no account', async () => {
    prisma.authUser.findUnique.mockResolvedValue(null);
    await mail.send('stranger@x.com', '123456');
    expect(send).not.toHaveBeenCalled();
  });

  it('skips an account that is already confirmed', async () => {
    prisma.authUser.findUnique.mockResolvedValue({ emailVerified: true });
    await mail.send('jess@band.com', '123456');
    expect(send).not.toHaveBeenCalled();
  });

  it('escapes the code in the HTML and keys resends apart', () => {
    const a = renderVerifyEmailMail({ to: 'a@b.com', code: '111111' });
    const b = renderVerifyEmailMail({ to: 'a@b.com', code: '222222' });
    expect(a.html).toContain('111111');
    expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
  });
});
