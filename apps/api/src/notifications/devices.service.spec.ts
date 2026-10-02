import { DevicesService } from './devices.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DevicesService', () => {
  const deviceToken = { upsert: jest.fn(), deleteMany: jest.fn() };
  const prisma = {
    deviceToken,
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      fn({ deviceToken }),
    ),
  };
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

  // The upsert is always scoped to the caller, so it can never rewrite another
  // account's row in place.
  it('scopes the upsert to the caller', async () => {
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

  /**
   * A phone handed from one bandmate to another must stop delivering the
   * previous owner's notification content to the new owner's lock screen. The
   * newest registration claims the device.
   */
  it('removes other accounts rows for the same token', async () => {
    await service.register('u2', { token: 'tok-a', platform: 'IOS' });

    expect(deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: 'tok-a', userId: { not: 'u2' } },
    });
  });

  // Between the delete and the upsert the device belongs to nobody. A
  // notification resolving recipients in that window would skip a phone that
  // is in fact registered.
  it('claims the device in a single transaction', async () => {
    await service.register('u2', { token: 'tok-a', platform: 'IOS' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(deviceToken.deleteMany).toHaveBeenCalled();
    expect(deviceToken.upsert).toHaveBeenCalled();
  });

  // Own-token re-registration is the common path and must not delete the row
  // it is about to touch.
  it('does not delete the callers own row on a relaunch', async () => {
    await service.register('u1', { token: 'tok-a', platform: 'IOS' });

    const [args] = deviceToken.deleteMany.mock.calls[0] as [
      { where: { userId: { not: string } } },
    ];
    expect(args.where.userId).toEqual({ not: 'u1' });
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
