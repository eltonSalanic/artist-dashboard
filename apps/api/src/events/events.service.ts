import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  can,
  defaultShowStatus,
  type BoardRole,
  type ChangeShowStatusDto,
  type CreateEventDto,
  type EventQueryDto,
  type EventType,
  type ShowStatusCategory,
  type UpdateEventDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../attachments/storage.service';
import { ActivityService } from '../activity/activity.service';

const eventInclude = {
  // Archived tasks belong to the archive page, not to their event's count —
  // this is also the number the "also archive N tasks" prompt shows.
  _count: { select: { tasks: { where: { archivedAt: null } } } },
  showStatus: {
    select: { id: true, name: true, color: true, category: true },
  },
} satisfies Prisma.EventInclude;

type ShowStatusRef = {
  id: string;
  name: string;
  color: string;
  category: ShowStatusCategory;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async list(boardId: string, query: EventQueryDto) {
    const events = await this.prisma.event.findMany({
      where: {
        boardId,
        archivedAt: null,
        ...(query.type ? { type: query.type } : {}),
        ...(query.showStatusId ? { showStatusId: query.showStatusId } : {}),
        // A cancelled show stays on record but out of lists and counts. Shows
        // only — everything else has no status, which `NOT` lets through.
        ...(query.includeCancelled
          ? {}
          : {
              NOT: { showStatus: { is: { category: 'CANCELLED' as const } } },
            }),
        ...(query.from || query.to
          ? {
              startsAt: {
                ...(query.from ? { gte: query.from } : {}),
                ...(query.to ? { lt: query.to } : {}),
              },
            }
          : {}),
      },
      include: eventInclude,
      orderBy: { startsAt: 'asc' },
      ...(query.limit ? { take: query.limit } : {}),
    });
    return events.map(this.toDto);
  }

  /** Archived events stay fetchable — the archive page opens this same detail. */
  async findOne(boardId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
      include: eventInclude,
    });
    if (!event) throw new NotFoundException('Event not found');
    const [archivedTaskCount, linkedTaskCount] = await Promise.all([
      // What went down with this event — the "also restore" prompt.
      this.prisma.task.count({ where: { boardId, archivedWithId: eventId } }),
      // Everything a cascading delete would take, archived or not.
      this.prisma.task.count({ where: { boardId, eventId } }),
    ]);
    return { ...this.toDto(event), archivedTaskCount, linkedTaskCount };
  }

  async create(boardId: string, dto: CreateEventDto, actorId: string) {
    const showStatusId = await this.resolveShowStatusId(
      boardId,
      dto.type,
      dto.showStatusId,
    );
    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          boardId,
          type: dto.type,
          title: dto.title,
          location: dto.location,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt ?? null,
          showStatusId,
        },
        include: eventInclude,
      });

      // Trigger 4 — the whole band, minus whoever added it.
      const recipients = await this.notifications.boardRecipients(
        tx,
        boardId,
        actorId,
      );
      await this.notifications.queue(
        tx,
        recipients.map((userId) => ({
          boardId,
          userId,
          category: 'SCHEDULE' as const,
          template: 'event-created',
          dedupeKey: `event-created:${created.id}:${userId}`,
          payload: {
            eventId: created.id,
            type: created.type,
            title: created.title,
            location: created.location,
            startsAt: created.startsAt.toISOString(),
          },
        })),
      );
      return created;
    });
    return this.toDto(event);
  }

  async update(
    boardId: string,
    eventId: string,
    dto: UpdateEventDto,
    actorId: string,
  ) {
    // Read before write: trigger 5 is a diff, and `update` otherwise hands the
    // dto straight to Prisma without ever seeing the old row.
    const before = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
      include: eventInclude,
    });
    if (!before) throw new NotFoundException('Event not found');

    // A show keeps its status unless given a new one; turning into a show
    // picks up the default; turning into anything else drops it (the CHECK on
    // Event insists on both).
    const { showStatusId: requested, ...fields } = dto;
    const showStatusId = await this.resolveShowStatusId(
      boardId,
      dto.type ?? before.type,
      requested ?? before.showStatusId ?? undefined,
    );

    const event = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { ...fields, showStatusId },
        include: eventInclude,
      });
      await this.logStatusChange(tx, actorId, before, updated);

      // Only the clock counts. A rename, a description edit or — deliberately —
      // a venue change is not worth an inbox; see docs/notifications.md.
      const moved =
        updated.startsAt.getTime() !== before.startsAt.getTime() ||
        (updated.endsAt?.getTime() ?? null) !==
          (before.endsAt?.getTime() ?? null);

      if (moved) {
        const recipients = await this.notifications.boardRecipients(
          tx,
          boardId,
          actorId,
        );
        await this.notifications.queue(
          tx,
          recipients.map((userId) => ({
            boardId,
            userId,
            category: 'SCHEDULE' as const,
            template: 'event-moved',
            // Keyed on the new time: moving it again notifies, replaying the
            // same move does not.
            dedupeKey: `event-moved:${eventId}:${updated.startsAt.getTime()}:${userId}`,
            payload: {
              eventId,
              type: updated.type,
              title: updated.title,
              location: updated.location,
              startsAt: updated.startsAt.toISOString(),
              previousStartsAt: before.startsAt.toISOString(),
            },
          })),
        );
      }
      return updated;
    });
    return this.toDto(event);
  }

  /**
   * Move one show to another status. Separate from `update` because it is open
   * to members ('show.changeStatus'), while the rest of a show is admin-only.
   *
   * Cancelling a show with money still expected for it reports how much, so
   * the client can point at it. Nothing is voided here:
   * the ledger only changes when someone changes it.
   */
  async changeStatus(
    boardId: string,
    eventId: string,
    dto: ChangeShowStatusDto,
    actorId: string,
    role: BoardRole,
  ) {
    if (!can(role, 'show.changeStatus')) {
      throw new ForbiddenException('Only board admins can do that');
    }
    const before = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
      include: eventInclude,
    });
    if (!before) throw new NotFoundException('Event not found');
    if (before.type !== 'SHOW') {
      throw new BadRequestException('Only shows have a status');
    }
    await this.assertShowStatusInBoard(boardId, dto.showStatusId);

    const event = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: { showStatusId: dto.showStatusId },
        include: eventInclude,
      });
      await this.logStatusChange(tx, actorId, before, updated);
      return updated;
    });

    const expected =
      event.showStatus?.category === 'CANCELLED'
        ? await this.prisma.financeEntry.aggregate({
            where: { boardId, eventId, kind: 'INCOME', state: 'EXPECTED' },
            _sum: { amountCents: true },
          })
        : null;
    return {
      ...this.toDto(event),
      expectedIncomeCents: expected?._sum.amountCents ?? 0,
    };
  }

  /**
   * With `cascadeTasks`, the event's tasks are deleted with it (attachments and
   * all). Without it they survive and `Task.eventId` is nulled by the database.
   */
  async remove(boardId: string, eventId: string, cascadeTasks = false) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
    });
    if (!event) throw new NotFoundException('Event not found');

    if (cascadeTasks) {
      // Every linked task at any depth — a subtask can carry its own eventId.
      const linked = await this.prisma.task.findMany({
        where: { boardId, eventId },
        select: { id: true },
      });
      await this.tasks.removeMany(
        boardId,
        linked.map((t) => t.id),
      );
    }

    // The event's own files: their rows cascade in the database, but the
    // stored objects don't, so the paths are collected before the rows go.
    const files = await this.prisma.attachment.findMany({
      where: { boardId, eventId },
      select: { storagePath: true },
    });
    await this.prisma.event.delete({ where: { id: eventId } });
    await this.storage.remove(files.map((file) => file.storagePath));
    return { deleted: true };
  }

  /** The status a show should carry after a write; null for non-shows. */
  private async resolveShowStatusId(
    boardId: string,
    type: EventType,
    requested: string | undefined,
  ): Promise<string | null> {
    if (type !== 'SHOW') return null;
    if (requested) {
      await this.assertShowStatusInBoard(boardId, requested);
      return requested;
    }
    const statuses = await this.prisma.showStatus.findMany({
      where: { boardId },
      select: { id: true, sortOrder: true, category: true },
    });
    const fallback = defaultShowStatus(statuses);
    if (!fallback) {
      throw new BadRequestException('Add a show status in settings first');
    }
    return fallback.id;
  }

  private async assertShowStatusInBoard(boardId: string, statusId: string) {
    const status = await this.prisma.showStatus.findFirst({
      where: { id: statusId, boardId },
      select: { id: true },
    });
    if (!status) throw new BadRequestException('Unknown show status');
  }

  private async logStatusChange(
    tx: Prisma.TransactionClient,
    actorId: string,
    before: { showStatus: ShowStatusRef | null },
    after: {
      id: string;
      boardId: string;
      title: string;
      showStatus: ShowStatusRef | null;
    },
  ) {
    // Only a move between two statuses is news. Becoming or stopping being a
    // show is a type change, not a status change.
    if (!before.showStatus || !after.showStatus) return;
    if (before.showStatus.id === after.showStatus.id) return;
    await this.activity.log(tx, {
      boardId: after.boardId,
      type: 'SHOW_STATUS_CHANGED',
      actorId,
      meta: {
        eventId: after.id,
        eventTitle: after.title,
        fromStatus: before.showStatus.name,
        toStatus: after.showStatus.name,
        toCategory: after.showStatus.category,
      },
    });
  }

  private toDto = (event: {
    id: string;
    boardId: string;
    type: string;
    title: string;
    location: string | null;
    startsAt: Date;
    endsAt: Date | null;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    showStatusId: string | null;
    showStatus: ShowStatusRef | null;
    _count: { tasks: number };
  }) => ({
    id: event.id,
    boardId: event.boardId,
    type: event.type,
    title: event.title,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    archivedAt: event.archivedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    showStatusId: event.showStatusId,
    showStatus: event.showStatus,
    taskCount: event._count.tasks,
  });
}
