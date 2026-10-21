import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../attachments/storage.service';

describe('EventsService notifications', () => {
  const startsAt = new Date('2026-09-04T20:00:00Z');

  const stored = {
    id: 'e1',
    boardId: 'b1',
    type: 'SHOW',
    title: 'Neon Harbor at The Echo',
    location: 'The Echo',
    startsAt,
    endsAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { tasks: 0 },
  };

  const storage = { remove: jest.fn() };
  const prisma = {
    event: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    attachment: { findMany: jest.fn() },
    membership: { findMany: jest.fn() },
    notificationDelivery: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const service = new EventsService(
    prisma as unknown as PrismaService,
    { removeMany: jest.fn() } as unknown as TasksService,
    new NotificationsService(prisma as unknown as PrismaService),
    storage as unknown as StorageService,
  );

  /** Rows the outbox was asked to write on the last call. */
  const queued = (): {
    userId: string;
    template: string;
    dedupeKey: string;
    payload: Record<string, unknown>;
  }[] => {
    const calls = prisma.notificationDelivery.createMany.mock.calls as [
      {
        data: {
          userId: string;
          template: string;
          dedupeKey: string;
          channel: string;
          payload: Record<string, unknown>;
        }[];
      },
    ][];
    // Filtered to one channel: queue() fans each notification out across
    // channels, and these assertions are about who is notified and with what
    // key — identical on every channel.
    return calls.length
      ? calls[calls.length - 1][0].data.filter((row) => row.channel === 'EMAIL')
      : [];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.membership.findMany.mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
      { userId: 'u3' },
    ]);
  });

  describe('create', () => {
    it('tells the whole band except whoever added it', async () => {
      prisma.event.create.mockResolvedValue(stored);

      await service.create(
        'b1',
        {
          type: 'SHOW',
          title: 'Neon Harbor at The Echo',
          startsAt,
        } as never,
        'u1',
      );

      expect(queued().map((row) => row.userId)).toEqual(['u2', 'u3']);
      expect(queued()[0]).toEqual(
        expect.objectContaining({
          template: 'event-created',
          dedupeKey: 'event-created:e1:u2',
        }),
      );
    });
  });

  describe('update', () => {
    const movedTo = new Date('2026-09-05T21:00:00Z');

    it('notifies when the start time moves, carrying the old time too', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue({ ...stored, startsAt: movedTo });

      await service.update('b1', 'e1', { startsAt: movedTo } as never, 'u1');

      expect(queued().map((row) => row.userId)).toEqual(['u2', 'u3']);
      expect(queued()[0].payload).toEqual(
        expect.objectContaining({
          startsAt: movedTo.toISOString(),
          previousStartsAt: startsAt.toISOString(),
        }),
      );
    });

    it('keys on the new time so the same move cannot notify twice', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue({ ...stored, startsAt: movedTo });

      await service.update('b1', 'e1', { startsAt: movedTo } as never, 'u1');

      expect(queued()[0].dedupeKey).toBe(
        `event-moved:e1:${movedTo.getTime()}:u2`,
      );
    });

    it('stays quiet for a rename', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue({ ...stored, title: 'New name' });

      await service.update('b1', 'e1', { title: 'New name' }, 'u1');

      expect(prisma.notificationDelivery.createMany).not.toHaveBeenCalled();
    });

    it('stays quiet for a venue change — that is the group chat’s job', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue({
        ...stored,
        location: 'Somewhere else',
      });

      await service.update('b1', 'e1', { location: 'Somewhere else' }, 'u1');

      expect(prisma.notificationDelivery.createMany).not.toHaveBeenCalled();
    });

    it('notifies when only the end time changes', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue({
        ...stored,
        endsAt: new Date('2026-09-04T23:00:00Z'),
      });

      await service.update('b1', 'e1', {}, 'u1');

      expect(queued()).toHaveLength(2);
    });
  });

  describe('remove', () => {
    it("purges the event's stored files along with it", async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.attachment.findMany.mockResolvedValue([
        { storagePath: 'b1/x/rider.pdf' },
      ]);

      await service.remove('b1', 'e1');

      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: { boardId: 'b1', eventId: 'e1' },
        select: { storagePath: true },
      });
      expect(prisma.event.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
      expect(storage.remove).toHaveBeenCalledWith(['b1/x/rider.pdf']);
    });
  });
});
