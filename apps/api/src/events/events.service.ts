import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateEventDto,
  EventQueryDto,
  UpdateEventDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const eventInclude = {
  // Archived tasks belong to the archive page, not to their event's count —
  // this is also the number the "also archive N tasks" prompt shows.
  _count: { select: { tasks: { where: { archivedAt: null } } } },
} satisfies Prisma.EventInclude;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

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
    // How many tasks went down with this event — the "also restore" prompt.
    const archivedTaskCount = await this.prisma.task.count({
      where: { boardId, archivedWithId: eventId },
    });
    return { ...this.toDto(event), archivedTaskCount };
  }

  async create(boardId: string, dto: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: {
        boardId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt ?? null,
      },
      include: eventInclude,
    });
    return this.toDto(event);
  }

  async update(boardId: string, eventId: string, dto: UpdateEventDto) {
    await this.findOne(boardId, eventId);
    const event = await this.prisma.event.update({
      where: { id: eventId },
      data: dto,
      include: eventInclude,
    });
    return this.toDto(event);
  }

  async remove(boardId: string, eventId: string) {
    await this.findOne(boardId, eventId);
    await this.prisma.event.delete({ where: { id: eventId } });
    return { deleted: true };
  }

  private toDto = (event: {
    id: string;
    boardId: string;
    type: string;
    title: string;
    description: string | null;
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
    description: event.description,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    archivedAt: event.archivedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    taskCount: event._count.tasks,
  });
}
