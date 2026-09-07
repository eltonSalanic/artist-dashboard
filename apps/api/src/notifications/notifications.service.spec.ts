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

describe('NotificationsService preferences', () => {
  const prisma = {
    notificationPreference: { findMany: jest.fn(), upsert: jest.fn() },
  };
  const service = new NotificationsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.notificationPreference.findMany.mockResolvedValue([]);
  });

  it('reports every category as on when nothing has been saved', async () => {
    await expect(service.preferences('b1', 'u1')).resolves.toEqual({
      MENTIONS: true,
      ASSIGNMENTS: true,
      SCHEDULE: true,
      REMINDERS: true,
    });
  });

  it('reports a stored row and leaves the rest on', async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([
      { category: 'SCHEDULE', enabled: false },
    ]);

    const prefs = await service.preferences('b1', 'u1');
    expect(prefs.SCHEDULE).toBe(false);
    expect(prefs.MENTIONS).toBe(true);
  });

  it('ignores a DUE_TASKS row — the digest was cut, so there is no toggle for it', async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([
      { category: 'DUE_TASKS', enabled: false },
    ]);

    await expect(service.preferences('b1', 'u1')).resolves.toEqual({
      MENTIONS: true,
      ASSIGNMENTS: true,
      SCHEDULE: true,
      REMINDERS: true,
    });
  });

  it('upserts, so the first toggle writes the row and later ones flip it', async () => {
    await service.setPreference('b1', 'u1', 'MENTIONS', false);

    const [args] = prisma.notificationPreference.upsert.mock.calls[0] as [
      { create: unknown; update: unknown },
    ];
    expect(args.create).toEqual({
      boardId: 'b1',
      userId: 'u1',
      category: 'MENTIONS',
      enabled: false,
    });
    expect(args.update).toEqual({ enabled: false });
  });
});
