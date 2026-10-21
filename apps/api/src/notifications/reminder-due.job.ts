import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

/** How often the job looks for reminders that have come due. */
const EVERY_5_MINUTES = 5 * 60_000;

/**
 * How far back a due reminder still counts. Without it, a first deploy — or a
 * restart after a long outage — would queue every reminder the board has ever
 * set, all at once. Anything older than this was missed, and staying missed is
 * the kinder failure.
 */
const BACKFILL_WINDOW_MS = 24 * 60 * 60_000;

/**
 * Trigger 6. The only clock-driven trigger, and the simplest kind: `remindAt`
 * is an absolute instant, so there is no board-local hour to select on and no
 * DST edge — the board's timezone only decides how the time is rendered.
 *
 * Reminders have no owner column, so the whole board is notified. Safe to run
 * on every instance: `queue()` writes through a unique `dedupeKey`, so a second
 * instance waking at the same moment adds nothing.
 */
@Injectable()
export class ReminderDueJob {
  private readonly logger = new Logger(ReminderDueJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Interval(EVERY_5_MINUTES)
  async tick(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      // Same rule as the dispatcher: a tick must never throw, or the next one
      // never happens.
      this.logger.error('Reminder job failed', error as Error);
    }
  }

  async run(now = new Date()): Promise<number> {
    const due = await this.prisma.reminder.findMany({
      where: {
        done: false,
        archivedAt: null,
        remindAt: {
          // `null` is excluded by the range itself: an undated reminder is a
          // note, not an alarm.
          lte: now,
          gte: new Date(now.getTime() - BACKFILL_WINDOW_MS),
        },
      },
      // The first note stands in for the old description in the message.
      include: {
        notes: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { body: true },
        },
      },
    });

    let queued = 0;
    for (const reminder of due) {
      const recipients = await this.notifications.boardRecipients(
        this.prisma,
        reminder.boardId,
      );
      if (recipients.length === 0) continue;

      await this.notifications.queue(
        this.prisma,
        recipients.map((userId) => ({
          boardId: reminder.boardId,
          userId,
          category: 'REMINDERS' as const,
          template: 'reminder-due',
          // The reminder's own time, so rescheduling it notifies again while
          // the next tick over the same due reminder does not.
          dedupeKey: `reminder:${reminder.id}:${reminder.remindAt!.getTime()}:${userId}`,
          payload: {
            reminderId: reminder.id,
            title: reminder.title,
            description: reminder.notes[0]?.body || null,
            remindAt: reminder.remindAt!.toISOString(),
          },
        })),
      );
      queued += recipients.length;
    }
    return queued;
  }
}
