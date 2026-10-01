import { ReminderDueJob } from './reminder-due.job';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const NOW = new Date('2026-09-05T18:00:00.000Z');

const reminder = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'r1',
  boardId: 'b1',
  title: 'Load in at 4',
  description: null,
  remindAt: new Date('2026-09-05T17:58:00.000Z'),
  done: false,
  archivedAt: null,
  ...overrides,
});

function setup(rows: ReturnType<typeof reminder>[], members = ['u1', 'u2']) {
  const prisma = {
    reminder: { findMany: jest.fn().mockResolvedValue(rows) },
    membership: {
      findMany: jest
        .fn()
        .mockResolvedValue(members.map((userId) => ({ userId }))),
    },
    notificationDelivery: { createMany: jest.fn() },
  };
  const notifications = new NotificationsService(
    prisma as unknown as PrismaService,
  );
  const job = new ReminderDueJob(
    prisma as unknown as PrismaService,
    notifications,
  );
  return { job, prisma };
}

/**
 * Queued rows, narrowed to the email channel. `queue()` fans every
 * notification out across channels, and these tests are about *who* gets told
 * and *how often* — questions that are the same on every channel, so counting
 * one channel keeps them readable.
 */
const queuedRows = (prisma: {
  notificationDelivery: { createMany: jest.Mock };
}) =>
  prisma.notificationDelivery.createMany.mock.calls
    .flatMap(
      ([args]: [
        { data: { userId: string; dedupeKey: string; channel: string }[] },
      ]) => args.data,
    )
    .filter((row) => row.channel === 'EMAIL');

describe('ReminderDueJob', () => {
  it('notifies every board member — reminders have no owner', async () => {
    const { job, prisma } = setup([reminder()]);

    await expect(job.run(NOW)).resolves.toBe(2);
    expect(queuedRows(prisma).map((r) => r.userId)).toEqual(['u1', 'u2']);
  });

  it('selects only reminders that are due, undone and unarchived', async () => {
    const { job, prisma } = setup([reminder()]);
    await job.run(NOW);

    const [args] = prisma.reminder.findMany.mock.calls[0] as [
      { where: { done: boolean; archivedAt: null; remindAt: { lte: Date } } },
    ];
    expect(args.where.done).toBe(false);
    expect(args.where.archivedAt).toBeNull();
    expect(args.where.remindAt.lte).toEqual(NOW);
  });

  it('ignores anything more than 24h overdue, so a first deploy does not fire the backlog', async () => {
    const { job, prisma } = setup([reminder()]);
    await job.run(NOW);

    const [args] = prisma.reminder.findMany.mock.calls[0] as [
      { where: { remindAt: { gte: Date } } },
    ];
    expect(NOW.getTime() - args.where.remindAt.gte.getTime()).toBe(
      24 * 60 * 60_000,
    );
  });

  // A null remindAt is a note, not an alarm — the range excludes it in SQL,
  // so the guarantee lives in the `where` above rather than in a filter here.
  it('keys on the reminder time, so the next tick over the same reminder is a no-op', async () => {
    const { job, prisma } = setup([reminder()]);

    await job.run(NOW);
    await job.run(new Date(NOW.getTime() + 5 * 60_000));

    const at = reminder().remindAt.getTime();
    const keys = queuedRows(prisma).map((r) => r.dedupeKey);
    expect(keys).toEqual([
      `reminder:r1:${at}:u1`,
      `reminder:r1:${at}:u2`,
      `reminder:r1:${at}:u1`,
      `reminder:r1:${at}:u2`,
    ]);
    // Identical keys — `queue()` writes with skipDuplicates, so the second run
    // adds no rows.
  });

  it('rescheduling a reminder notifies again', async () => {
    const { job, prisma } = setup([reminder()]);
    await job.run(NOW);
    prisma.reminder.findMany.mockResolvedValue([
      reminder({ remindAt: new Date('2026-09-05T17:59:00.000Z') }),
    ]);
    await job.run(NOW);

    const keys = new Set(queuedRows(prisma).map((r) => r.dedupeKey));
    expect(keys.size).toBe(4);
  });

  it('queues nothing when a board has no members', async () => {
    const { job, prisma } = setup([reminder()], []);

    await expect(job.run(NOW)).resolves.toBe(0);
    expect(prisma.notificationDelivery.createMany).not.toHaveBeenCalled();
  });

  it('never throws out of the tick', async () => {
    const { job, prisma } = setup([reminder()]);
    prisma.reminder.findMany.mockRejectedValue(new Error('db down'));

    await expect(job.tick()).resolves.toBeUndefined();
  });
});
