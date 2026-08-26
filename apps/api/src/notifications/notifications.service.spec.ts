import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService.queue', () => {
  const prisma = { emailDelivery: { createMany: jest.fn() } };
  const service = new NotificationsService(prisma as unknown as PrismaService);

  const input = {
    boardId: 'b1',
    userId: 'u1',
    category: 'MENTIONS' as const,
    template: 'diagnostic',
    dedupeKey: 'mention:m1',
  };

  beforeEach(() => jest.clearAllMocks());

  it('writes one row per recipient', async () => {
    await service.queue(prisma as unknown as PrismaService, [
      input,
      { ...input, userId: 'u2', dedupeKey: 'mention:m2' },
    ]);

    const [args] = prisma.emailDelivery.createMany.mock.calls[0] as [
      { data: unknown[] },
    ];
    expect(args.data).toHaveLength(2);
  });

  it('skips duplicates rather than throwing, so a unique violation cannot poison the caller transaction', async () => {
    await service.queue(prisma as unknown as PrismaService, input);

    const [args] = prisma.emailDelivery.createMany.mock.calls[0] as [
      { skipDuplicates: boolean },
    ];
    expect(args.skipDuplicates).toBe(true);
  });

  it('writes nothing for an empty recipient list', async () => {
    await service.queue(prisma as unknown as PrismaService, []);
    expect(prisma.emailDelivery.createMany).not.toHaveBeenCalled();
  });

  it('defaults a missing payload to an empty object', async () => {
    await service.queue(prisma as unknown as PrismaService, input);

    const [args] = prisma.emailDelivery.createMany.mock.calls[0] as [
      { data: { payload: unknown }[] },
    ];
    expect(args.data[0].payload).toEqual({});
  });
});
