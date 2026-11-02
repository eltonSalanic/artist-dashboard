import type { PrismaService } from '../prisma/prisma.service';
import type { Auth } from '../auth/auth.tokens';
import { InviteMailer } from './invite-mailer.service';

describe('InviteMailer', () => {
  const prisma = { authUser: { findUnique: jest.fn() } };
  const sendVerificationOTP = jest.fn();
  const auth = { api: { sendVerificationOTP } } as unknown as Auth;
  const mailer = new InviteMailer(prisma as unknown as PrismaService, auth);

  beforeEach(() => jest.clearAllMocks());

  it('mails a code to someone with no account', async () => {
    prisma.authUser.findUnique.mockResolvedValue(null);

    await expect(mailer.inviteByEmail('mia@band.com')).resolves.toBe('sent');
    expect(sendVerificationOTP).toHaveBeenCalledWith({
      body: { email: 'mia@band.com', type: 'sign-in' },
    });
  });

  it('mails a code to an account whose email is unverified', async () => {
    // Their invite only converts once the email is proven, which the code does.
    prisma.authUser.findUnique.mockResolvedValue({ emailVerified: false });

    await expect(mailer.inviteByEmail('mia@band.com')).resolves.toBe('sent');
    expect(sendVerificationOTP).toHaveBeenCalled();
  });

  it('sends nothing to a verified account', async () => {
    prisma.authUser.findUnique.mockResolvedValue({ emailVerified: true });

    await expect(mailer.inviteByEmail('mia@band.com')).resolves.toBe(
      'already_registered',
    );
    expect(sendVerificationOTP).not.toHaveBeenCalled();
  });
});
