import { ConflictException } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { PrismaService } from '../prisma/prisma.service';
import { InviteMailer } from './invite-mailer.service';

describe('InvitesService', () => {
  const prisma = {
    membership: { findFirst: jest.fn() },
    invite: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  };
  const mailer = { inviteByEmail: jest.fn() };
  const service = new InvitesService(
    prisma as unknown as PrismaService,
    mailer as unknown as InviteMailer,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects inviting an existing board member', async () => {
    prisma.membership.findFirst.mockResolvedValue({ id: 'm1' });
    await expect(
      service.create('b1', 'admin1', { email: 'mike@band.com', role: 'USER' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mailer.inviteByEmail).not.toHaveBeenCalled();
  });

  it('normalizes the email, upserts the invite, and sends the email', async () => {
    prisma.membership.findFirst.mockResolvedValue(null);
    prisma.invite.upsert.mockResolvedValue({
      id: 'i1',
      email: 'mike@band.com',
    });
    mailer.inviteByEmail.mockResolvedValue('sent');

    const result = await service.create('b1', 'admin1', {
      email: 'Mike@Band.com',
      role: 'USER',
    });

    expect(prisma.invite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { boardId_email: { boardId: 'b1', email: 'mike@band.com' } },
      }),
    );
    expect(result.delivery).toBe('sent');
  });

  it('re-inviting resets a previous invite to PENDING with the new role', async () => {
    prisma.membership.findFirst.mockResolvedValue(null);
    prisma.invite.upsert.mockResolvedValue({ id: 'i1' });
    mailer.inviteByEmail.mockResolvedValue('already_registered');

    const result = await service.create('b1', 'admin1', {
      email: 'mike@band.com',
      role: 'ADMIN',
    });

    expect(prisma.invite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { role: 'ADMIN', status: 'PENDING' },
      }),
    );
    expect(result.delivery).toBe('already_registered');
  });
});
