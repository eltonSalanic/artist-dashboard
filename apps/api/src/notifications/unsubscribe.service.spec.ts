import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UnsubscribeService } from './unsubscribe.service';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { signUnsubscribeToken } from './unsubscribe-token';

const SECRET = 'test-secret';
const CLAIMS = {
  userId: 'u1',
  boardId: 'b1',
  category: 'SCHEDULE' as const,
};

function setup(overrides: { board?: unknown; user?: unknown } = {}) {
  const prisma = {
    board: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          'board' in overrides ? overrides.board : { name: 'Neon Harbor' },
        ),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue('user' in overrides ? overrides.user : { id: 'u1' }),
    },
    notificationPreference: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const notifications = new NotificationsService(
    prisma as unknown as PrismaService,
  );
  const service = new UnsubscribeService(
    prisma as unknown as PrismaService,
    notifications,
    { getOrThrow: () => SECRET } as unknown as ConfigService,
  );
  return { service, prisma };
}

describe('UnsubscribeService', () => {
  it('turns off exactly the category the token names', async () => {
    const { service, prisma } = setup();

    await expect(
      service.unsubscribe(signUnsubscribeToken(CLAIMS, SECRET)),
    ).resolves.toEqual({ category: 'SCHEDULE', boardName: 'Neon Harbor' });

    const [args] = prisma.notificationPreference.upsert.mock.calls[0] as [
      { where: { boardId_userId_category_channel: unknown }; create: unknown },
    ];
    expect(args.where.boardId_userId_category_channel).toEqual({
      boardId: 'b1',
      userId: 'u1',
      category: 'SCHEDULE',
      // An email unsubscribe link silences email, not push: one click in a
      // mail client must not also kill the person's phone notifications.
      channel: 'EMAIL',
    });
    expect(args.create).toEqual({ ...CLAIMS, channel: 'EMAIL', enabled: false });
  });

  it('rejects a tampered token without touching preferences', async () => {
    const { service, prisma } = setup();
    const token = signUnsubscribeToken(CLAIMS, SECRET);
    const tampered = token.replace(
      /^[^.]+/,
      Buffer.from('u2:b1:SCHEDULE').toString('base64url'),
    );

    await expect(service.unsubscribe(tampered)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('rejects a token signed with a different secret', async () => {
    const { service } = setup();
    await expect(
      service.unsubscribe(signUnsubscribeToken(CLAIMS, 'other-secret')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty or malformed token', async () => {
    const { service } = setup();
    await expect(service.unsubscribe('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.unsubscribe('garbage')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a link for a board that no longer exists', async () => {
    const { service, prisma } = setup({ board: null });

    await expect(
      service.unsubscribe(signUnsubscribeToken(CLAIMS, SECRET)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.notificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('is idempotent — a second click lands on the same state', async () => {
    const { service, prisma } = setup();
    const token = signUnsubscribeToken(CLAIMS, SECRET);

    await service.unsubscribe(token);
    await expect(service.unsubscribe(token)).resolves.toEqual({
      category: 'SCHEDULE',
      boardName: 'Neon Harbor',
    });
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledTimes(2);
  });
});
