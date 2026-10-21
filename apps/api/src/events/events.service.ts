import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateEventDto,
  EventQueryDto,
  UpdateEventDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../attachments/storage.service';

const eventInclude = {
  // Archived tasks belong to the archive page, not to their event's count —
  // this is also the number the "also archive N tasks" prompt shows.
  _count: { select: { tasks: { where: { archivedAt: null } } } },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  async list(boardId: string, query: EventQueryDto) {
    const events = await this.prisma.event.findMany({
      where: {
        boardId,
        archivedAt: null,
        ...(query.type ? { type: query.type } : {}),
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
    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          boardId,
          type: dto.type,
          title: dto.title,
          location: dto.location,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt ?? null,
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
    });
    if (!before) throw new NotFoundException('Event not found');

    const event = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({
        where: { id: eventId },
        data: dto,
        include: eventInclude,
      });

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
    taskCount: event._count.tasks,
  });
}
