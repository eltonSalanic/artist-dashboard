import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../attachments/storage.service';
import { ActivityService } from '../activity/activity.service';

describe('EventsService notifications', () => {
  const startsAt = new Date('2026-09-04T20:00:00Z');

  const hold = {
    id: 's-hold',
    name: 'Hold',
    color: '#8b8fa3',
    category: 'HOLD',
  };
  const confirmed = {
    id: 's-confirmed',
    name: 'Confirmed',
    color: '#2fbf71',
    category: 'BOOKED',
  };
  const cancelled = {
    id: 's-cancelled',
    name: 'Cancelled',
    color: '#e5484d',
    category: 'CANCELLED',
  };

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
    showStatusId: confirmed.id,
    showStatus: confirmed,
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
    showStatus: { findFirst: jest.fn(), findMany: jest.fn() },
    financeEntry: { count: jest.fn() },
    membership: { findMany: jest.fn() },
    notificationDelivery: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const activity = { log: jest.fn() };
  const service = new EventsService(
    prisma as unknown as PrismaService,
    { removeMany: jest.fn() } as unknown as TasksService,
    new NotificationsService(prisma as unknown as PrismaService),
    storage as unknown as StorageService,
    activity as unknown as ActivityService,
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
    prisma.showStatus.findFirst.mockImplementation(
      ({ where }: { where: { id: string; boardId: string } }) =>
        where.boardId === 'b1' &&
        [hold, confirmed, cancelled].some((s) => s.id === where.id)
          ? { id: where.id }
          : null,
    );
    prisma.showStatus.findMany.mockResolvedValue([
      { id: cancelled.id, sortOrder: 0, category: 'CANCELLED' },
      { id: confirmed.id, sortOrder: 2, category: 'BOOKED' },
      { id: hold.id, sortOrder: 1, category: 'HOLD' },
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

  describe('show statuses', () => {
    const createData = () =>
      (
        prisma.event.create.mock.calls[0] as [
          { data: { showStatusId: string | null } },
        ]
      )[0].data;
    const updateData = () =>
      (
        prisma.event.update.mock.calls[0] as [
          { data: { showStatusId: string | null } },
        ]
      )[0].data;

    it('starts a new show in the first status that is not a cancellation', async () => {
      prisma.event.create.mockResolvedValue(stored);
      await service.create(
        'b1',
        { type: 'SHOW', title: 'X', startsAt: startsAt.toISOString() },
        'u1',
      );
      expect(createData().showStatusId).toBe(hold.id);
    });

    it('takes a status picked at creation', async () => {
      prisma.event.create.mockResolvedValue(stored);
      await service.create(
        'b1',
        {
          type: 'SHOW',
          title: 'X',
          startsAt: startsAt.toISOString(),
          showStatusId: confirmed.id,
        },
        'u1',
      );
      expect(createData().showStatusId).toBe(confirmed.id);
    });

    it('gives a rehearsal no status, whatever it was sent', async () => {
      prisma.event.create.mockResolvedValue({ ...stored, type: 'REHEARSAL' });
      await service.create(
        'b1',
        {
          type: 'REHEARSAL',
          title: 'X',
          startsAt: startsAt.toISOString(),
          showStatusId: confirmed.id,
        },
        'u1',
      );
      expect(createData().showStatusId).toBeNull();
    });

    it("refuses another board's status", async () => {
      await expect(
        service.create(
          'b1',
          {
            type: 'SHOW',
            title: 'X',
            startsAt: startsAt.toISOString(),
            showStatusId: 'someone-elses',
          },
          'u1',
        ),
      ).rejects.toThrow('Unknown show status');
    });

    it('drops the status when a show becomes a meeting', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue({
        ...stored,
        type: 'MEETING',
        showStatusId: null,
        showStatus: null,
      });
      await service.update('b1', 'e1', { type: 'MEETING' }, 'u1');
      expect(updateData().showStatusId).toBeNull();
      expect(activity.log).not.toHaveBeenCalled();
    });

    it('keeps the status through an unrelated edit', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue(stored);
      await service.update('b1', 'e1', { title: 'Renamed' }, 'u1');
      expect(updateData().showStatusId).toBe(confirmed.id);
    });

    it('logs a move between statuses for the feed', async () => {
      prisma.event.findFirst.mockResolvedValue({
        ...stored,
        showStatusId: hold.id,
        showStatus: hold,
      });
      prisma.event.update.mockResolvedValue(stored);

      await service.changeStatus(
        'b1',
        'e1',
        { showStatusId: confirmed.id },
        'u2',
        'USER',
      );

      expect(activity.log).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          type: 'SHOW_STATUS_CHANGED',
          actorId: 'u2',
          meta: expect.objectContaining({
            eventTitle: stored.title,
            fromStatus: 'Hold',
            toStatus: 'Confirmed',
          }),
        }),
      );
    });

    it('stays quiet when the status does not change', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue(stored);
      await service.changeStatus(
        'b1',
        'e1',
        { showStatusId: confirmed.id },
        'u2',
        'USER',
      );
      expect(activity.log).not.toHaveBeenCalled();
    });

    it('counts expected income left on a cancelled show', async () => {
      prisma.event.findFirst.mockResolvedValue(stored);
      prisma.event.update.mockResolvedValue({
        ...stored,
        showStatusId: cancelled.id,
        showStatus: cancelled,
      });
      prisma.financeEntry.count.mockResolvedValue(2);

      const result = await service.changeStatus(
        'b1',
        'e1',
        { showStatusId: cancelled.id },
        'u1',
        'ADMIN',
      );

      expect(result.expectedIncomeCount).toBe(2);
      expect(prisma.financeEntry.count).toHaveBeenCalledWith({
        where: {
          boardId: 'b1',
          eventId: 'e1',
          kind: 'INCOME',
          state: 'EXPECTED',
        },
      });
    });

    it('refuses a status on a rehearsal', async () => {
      prisma.event.findFirst.mockResolvedValue({
        ...stored,
        type: 'REHEARSAL',
        showStatusId: null,
        showStatus: null,
      });
      await expect(
        service.changeStatus(
          'b1',
          'e1',
          { showStatusId: confirmed.id },
          'u1',
          'ADMIN',
        ),
      ).rejects.toThrow('Only shows have a status');
    });
  });
});
