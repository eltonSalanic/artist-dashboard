import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DevicesService', () => {
  const deviceToken = { upsert: jest.fn(), deleteMany: jest.fn() };
  const prisma = { deviceToken };
  const service = new DevicesService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  // The same install re-registers on every launch. Keyed on anything but the
  // token, that would accumulate rows and the user would get one notification
  // once per launch they had ever made.
  it('upserts per (user, token) so a relaunch does not add a second row', async () => {
    await service.register('u1', { token: 'tok-a', platform: 'IOS' });

    const [args] = deviceToken.upsert.mock.calls[0] as [
      { where: unknown; create: unknown; update: Record<string, unknown> },
    ];
    expect(args.where).toEqual({
      userId_token: { userId: 'u1', token: 'tok-a' },
    });
    expect(args.create).toEqual({
      userId: 'u1',
      token: 'tok-a',
      platform: 'IOS',
    });
    expect(args.update).toMatchObject({ platform: 'IOS' });
    expect(args.update.lastSeenAt).toBeInstanceOf(Date);
  });

  // The register call must never move a token between accounts. If it could,
  // knowing someone's push token would be enough to redirect their
  // notifications to your own account and silence their phone.
  it('never reassigns a token to a different user', async () => {
    await service.register('u2', { token: 'tok-a', platform: 'ANDROID' });

    const [args] = deviceToken.upsert.mock.calls[0] as [
      { where: { userId_token: unknown }; update: Record<string, unknown> },
    ];
    expect(args.where.userId_token).toEqual({
      userId: 'u2',
      token: 'tok-a',
    });
    expect(args.update).not.toHaveProperty('userId');
  });

  // Without the userId in the filter, knowing a token string would be enough
  // to silence someone else's phone.
  it('only lets a caller unregister their own token', async () => {
    await service.unregister('u1', 'tok-a');
    expect(deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', token: 'tok-a' },
    });
  });
});
