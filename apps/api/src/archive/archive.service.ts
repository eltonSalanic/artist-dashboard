import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ArchiveActionDto,
  ArchiveKind,
  ArchiveQueryDto,
  EventType,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

export interface ArchiveItemDto {
  /** What kind of record this is — drives the type chip and click-through. */
  kind: ArchiveKind;
  id: string;
  title: string;
  archivedAt: Date;
  /** The date the item was originally pinned to; null for undated items. */
  date: Date | null;
  event?: { type: EventType; location: string | null };
  task?: { statusName: string; statusColor: string; isDone: boolean };
  goal?: { period: string; completed: boolean };
}

/**
 * The archive is the other side of every widget: one list of everything that
 * has been archived off the dashboard, and the two writes that move items in
 * and out of it.
 *
 * Reads follow `CalendarService` — fan out one query per source, map to a
 * discriminated item, merge and sort in memory. Writes never touch Storage;
 * that irreversibility is what separates archiving from deleting.
 */
@Injectable()
export class ArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  async list(
    boardId: string,
    query: ArchiveQueryDto,
  ): Promise<ArchiveItemDto[]> {
    const archived = { not: null };
    const newestFirst = { archivedAt: 'desc' as const };
    const take = query.limit;

    const [tasks, goals, events, reminders] = await Promise.all([
      this.prisma.task.findMany({
        where: { boardId, archivedAt: archived },
        include: { status: true },
        orderBy: newestFirst,
        take,
      }),
      this.prisma.goal.findMany({
        where: { boardId, archivedAt: archived },
        orderBy: newestFirst,
        take,
      }),
      this.prisma.event.findMany({
        where: { boardId, archivedAt: archived },
        orderBy: newestFirst,
        take,
      }),
      this.prisma.reminder.findMany({
        where: { boardId, archivedAt: archived },
        orderBy: newestFirst,
        take,
      }),
    ]);

    const items: ArchiveItemDto[] = [
      ...tasks.map((t): ArchiveItemDto => ({
        kind: 'TASK',
        id: t.id,
        title: t.title,
        archivedAt: t.archivedAt as Date,
        date: t.dueDate,
        task: {
          statusName: t.status.name,
          statusColor: t.status.color,
          isDone: t.status.isDone,
        },
      })),
      ...goals.map((g): ArchiveItemDto => ({
        kind: 'GOAL',
        id: g.id,
        title: g.title,
        archivedAt: g.archivedAt as Date,
        date: g.dueDate,
        goal: { period: g.period, completed: g.completedAt !== null },
      })),
      ...events.map((e): ArchiveItemDto => ({
        kind: 'EVENT',
        id: e.id,
        title: e.title,
        archivedAt: e.archivedAt as Date,
        date: e.startsAt,
        event: { type: e.type, location: e.location },
      })),
      ...reminders.map((r): ArchiveItemDto => ({
        kind: 'REMINDER',
        id: r.id,
        title: r.title,
        archivedAt: r.archivedAt as Date,
        date: r.remindAt,
      })),
    ];

    // Each source was capped at `limit`; the merged list has to be too.
    return items
      .sort((a, b) => b.archivedAt.getTime() - a.archivedAt.getTime())
      .slice(0, take);
  }

  /**
   * Move an item off the dashboard. Archiving is idempotent — an item that is
   * already archived keeps its original timestamp and provenance.
   */
  async archive(
    boardId: string,
    kind: ArchiveKind,
    id: string,
    dto: ArchiveActionDto,
  ) {
    const now = new Date();

    switch (kind) {
      case 'TASK': {
        await this.assertExists(boardId, kind, id);
        // Subtasks are part of their task, so they always follow it — no
        // prompt. They carry the parent's id so a restore can find them.
        const tree = await this.tasks.collectTaskTree(id);
        const descendants = tree.filter((t) => t !== id);
        await this.prisma.$transaction(async (tx) => {
          await tx.task.updateMany({
            where: { id, boardId, archivedAt: null },
            data: { archivedAt: now, archivedWithId: null },
          });
          await tx.task.updateMany({
            where: { id: { in: descendants }, boardId, archivedAt: null },
            data: { archivedAt: now, archivedWithId: id },
          });
        });
        break;
      }

      case 'GOAL':
      case 'EVENT': {
        await this.assertExists(boardId, kind, id);
        const taskIds = dto.cascadeTasks
          ? await this.linkedTaskTrees(boardId, kind, id)
          : [];
        await this.prisma.$transaction(async (tx) => {
          if (kind === 'GOAL') {
            await tx.goal.updateMany({
              where: { id, boardId, archivedAt: null },
              data: { archivedAt: now },
            });
          } else {
            await tx.event.updateMany({
              where: { id, boardId, archivedAt: null },
              data: { archivedAt: now },
            });
          }
          if (taskIds.length > 0) {
            // Everything swept in points at the parent, whatever its depth,
            // so one restore query brings the whole set back.
            await tx.task.updateMany({
              where: { id: { in: taskIds }, boardId, archivedAt: null },
              data: { archivedAt: now, archivedWithId: id },
            });
          }
        });
        break;
      }

      case 'REMINDER': {
        await this.assertExists(boardId, kind, id);
        await this.prisma.reminder.updateMany({
          where: { id, boardId, archivedAt: null },
          data: { archivedAt: now },
        });
        break;
      }
    }

    return { archived: true };
  }

  /** Put an item back on the dashboard. Idempotent, like `archive`. */
  async restore(
    boardId: string,
    kind: ArchiveKind,
    id: string,
    dto: ArchiveActionDto,
  ) {
    await this.assertExists(boardId, kind, id);
    const revived = { archivedAt: null, archivedWithId: null };

    switch (kind) {
      case 'TASK':
        await this.prisma.$transaction(async (tx) => {
          await tx.task.updateMany({ where: { id, boardId }, data: revived });
          // Subtasks that went down with it come back with it.
          await tx.task.updateMany({
            where: { boardId, archivedWithId: id },
            data: revived,
          });
        });
        break;

      case 'GOAL':
      case 'EVENT':
        await this.prisma.$transaction(async (tx) => {
          if (kind === 'GOAL') {
            await tx.goal.updateMany({
              where: { id, boardId },
              data: { archivedAt: null },
            });
          } else {
            await tx.event.updateMany({
              where: { id, boardId },
              data: { archivedAt: null },
            });
          }
          if (dto.cascadeTasks) {
            await tx.task.updateMany({
              where: { boardId, archivedWithId: id },
              data: revived,
            });
          }
        });
        break;

      case 'REMINDER':
        await this.prisma.reminder.updateMany({
          where: { id, boardId },
          data: { archivedAt: null },
        });
        break;
    }

    return { restored: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  /** Linked tasks at any depth, plus their subtrees. */
  private async linkedTaskTrees(
    boardId: string,
    kind: 'GOAL' | 'EVENT',
    id: string,
  ): Promise<string[]> {
    const linked = await this.prisma.task.findMany({
      where: {
        boardId,
        archivedAt: null,
        ...(kind === 'GOAL' ? { goalId: id } : { eventId: id }),
      },
      select: { id: true },
    });
    const trees = await Promise.all(
      linked.map((t) => this.tasks.collectTaskTree(t.id)),
    );
    return [...new Set(trees.flat())];
  }

  private async assertExists(boardId: string, kind: ArchiveKind, id: string) {
    const where = { id, boardId };
    const found =
      kind === 'TASK'
        ? await this.prisma.task.findFirst({ where, select: { id: true } })
        : kind === 'GOAL'
          ? await this.prisma.goal.findFirst({ where, select: { id: true } })
          : kind === 'EVENT'
            ? await this.prisma.event.findFirst({ where, select: { id: true } })
            : await this.prisma.reminder.findFirst({
                where,
                select: { id: true },
              });
    if (!found) throw new NotFoundException('Item not found');
  }
}
