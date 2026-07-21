import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BoardRole,
  CreateChecklistItemDto,
  CreateTaskDto,
  ReorderTaskDto,
  SetAssigneesDto,
  TaskQueryDto,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from '@artist/shared';
import { can } from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SORT_GAP = 1024;

const taskInclude = {
  status: true,
  assignees: { include: { user: true } },
  _count: { select: { subtasks: true, checklist: true } },
  checklist: { orderBy: { sortOrder: 'asc' as const } },
  goal: { select: { id: true, title: true } },
  event: { select: { id: true, title: true, type: true, startsAt: true } },
} satisfies Prisma.TaskInclude;

/** Fields a regular member may change on someone else's task. */
const USER_EDITABLE_FIELDS: ReadonlySet<keyof UpdateTaskDto> = new Set([
  'statusId',
]);

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(boardId: string, query: TaskQueryDto) {
    const orderBy: Prisma.TaskOrderByWithRelationInput[] =
      query.sort === 'order'
        ? [{ sortOrder: 'asc' }]
        : query.sort === 'dueDate'
          ? [{ dueDate: { sort: 'asc', nulls: 'last' } }, { sortOrder: 'asc' }]
          : query.sort === 'priority'
            ? [{ priority: 'asc' }, { sortOrder: 'asc' }] // enum order: HIGH, MEDIUM, LOW
            : [{ createdAt: 'desc' }];

    const tasks = await this.prisma.task.findMany({
      where: {
        boardId,
        ...(query.search
          ? { title: { contains: query.search, mode: 'insensitive' } }
          : {}),
        ...(query.statusId ? { statusId: query.statusId } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.assigneeId
          ? { assignees: { some: { userId: query.assigneeId } } }
          : {}),
        ...(query.goalId ? { goalId: query.goalId } : {}),
        ...(query.eventId ? { eventId: query.eventId } : {}),
      },
      include: taskInclude,
      orderBy,
    });
    return tasks.map(this.toDto);
  }

  async findOne(boardId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, boardId },
      include: {
        ...taskInclude,
        subtasks: { include: taskInclude, orderBy: { sortOrder: 'asc' } },
        createdBy: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return {
      ...this.toDto(task),
      createdBy: {
        id: task.createdBy.id,
        displayName: task.createdBy.displayName,
      },
      subtasks: task.subtasks.map(this.toDto),
    };
  }

  async create(
    boardId: string,
    userId: string,
    role: BoardRole,
    dto: CreateTaskDto,
  ) {
    const action = dto.parentTaskId ? 'task.createSubtask' : 'task.create';
    if (!can(role, action)) {
      throw new ForbiddenException('Only board admins can create tasks');
    }

    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findFirst({
        where: { id: dto.parentTaskId, boardId },
        include: { parentTask: { select: { parentTaskId: true } } },
      });
      if (!parent) throw new NotFoundException('Task not found');
      // Root tasks are depth 0; subtasks may nest at most 2 levels deep.
      if (parent.parentTask?.parentTaskId) {
        throw new BadRequestException('Subtasks can only go two levels deep');
      }
    }

    const statusId = dto.statusId ?? (await this.defaultStatusId(boardId));
    await this.assertStatusInBoard(boardId, statusId);
    if (dto.goalId) await this.assertGoalInBoard(boardId, dto.goalId);
    if (dto.eventId) await this.assertEventInBoard(boardId, dto.eventId);

    const last = await this.prisma.task.aggregate({
      where: { boardId, parentTaskId: dto.parentTaskId ?? null },
      _max: { sortOrder: true },
    });

    const task = await this.prisma.task.create({
      data: {
        boardId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        statusId,
        dueDate: dto.dueDate ?? null,
        parentTaskId: dto.parentTaskId ?? null,
        goalId: dto.goalId ?? null,
        eventId: dto.eventId ?? null,
        createdById: userId,
        sortOrder: (last._max.sortOrder ?? 0) + SORT_GAP,
        assignees: {
          create: dto.assigneeIds.map((assigneeId) => ({ userId: assigneeId })),
        },
      },
      include: taskInclude,
    });
    return this.toDto(task);
  }

  async update(
    boardId: string,
    taskId: string,
    role: BoardRole,
    dto: UpdateTaskDto,
  ) {
    await this.getOwned(boardId, taskId);

    const fields = Object.keys(dto) as (keyof UpdateTaskDto)[];
    if (!can(role, 'task.editFields')) {
      const blocked = fields.filter((f) => !USER_EDITABLE_FIELDS.has(f));
      if (blocked.length > 0) {
        throw new ForbiddenException(
          `Members can only change a task's status (attempted: ${blocked.join(', ')})`,
        );
      }
    }
    if (dto.statusId) await this.assertStatusInBoard(boardId, dto.statusId);
    if (dto.goalId) await this.assertGoalInBoard(boardId, dto.goalId);
    if (dto.eventId) await this.assertEventInBoard(boardId, dto.eventId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: dto,
      include: taskInclude,
    });
    return this.toDto(task);
  }

  async remove(boardId: string, taskId: string) {
    await this.getOwned(boardId, taskId);
    await this.prisma.task.delete({ where: { id: taskId } });
    return { deleted: true };
  }

  /** Fractional reordering among siblings (same parent, same board). */
  async reorder(boardId: string, taskId: string, dto: ReorderTaskDto) {
    const task = await this.getOwned(boardId, taskId);

    let newOrder: number;
    if (dto.afterTaskId === null) {
      const first = await this.prisma.task.findFirst({
        where: {
          boardId,
          parentTaskId: task.parentTaskId,
          id: { not: taskId },
        },
        orderBy: { sortOrder: 'asc' },
        select: { sortOrder: true },
      });
      newOrder = first ? first.sortOrder - SORT_GAP : SORT_GAP;
    } else {
      const after = await this.getOwned(boardId, dto.afterTaskId);
      if (after.parentTaskId !== task.parentTaskId) {
        throw new BadRequestException(
          'Tasks can only be reordered among their siblings',
        );
      }
      const next = await this.prisma.task.findFirst({
        where: {
          boardId,
          parentTaskId: task.parentTaskId,
          sortOrder: { gt: after.sortOrder },
          id: { not: taskId },
        },
        orderBy: { sortOrder: 'asc' },
        select: { sortOrder: true },
      });
      newOrder = next
        ? (after.sortOrder + next.sortOrder) / 2
        : after.sortOrder + SORT_GAP;
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data: { sortOrder: newOrder },
    });
    return { id: taskId, sortOrder: newOrder };
  }

  async setAssignees(boardId: string, taskId: string, dto: SetAssigneesDto) {
    await this.getOwned(boardId, taskId);
    const members = await this.prisma.membership.findMany({
      where: { boardId, userId: { in: dto.assigneeIds } },
      select: { userId: true },
    });
    if (members.length !== dto.assigneeIds.length) {
      throw new BadRequestException('All assignees must be board members');
    }

    const task = await this.prisma.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      await tx.taskAssignee.createMany({
        data: dto.assigneeIds.map((userId) => ({ taskId, userId })),
      });
      return tx.task.findUniqueOrThrow({
        where: { id: taskId },
        include: taskInclude,
      });
    });
    return this.toDto(task);
  }

  async addChecklistItem(
    boardId: string,
    taskId: string,
    dto: CreateChecklistItemDto,
  ) {
    await this.getOwned(boardId, taskId);
    const last = await this.prisma.checklistItem.aggregate({
      where: { taskId },
      _max: { sortOrder: true },
    });
    return this.prisma.checklistItem.create({
      data: {
        taskId,
        text: dto.text,
        sortOrder: (last._max.sortOrder ?? 0) + SORT_GAP,
      },
    });
  }

  async updateChecklistItem(
    boardId: string,
    taskId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    await this.assertChecklistItem(boardId, taskId, itemId);
    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  async removeChecklistItem(boardId: string, taskId: string, itemId: string) {
    await this.assertChecklistItem(boardId, taskId, itemId);
    await this.prisma.checklistItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async getOwned(boardId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, boardId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async assertChecklistItem(
    boardId: string,
    taskId: string,
    itemId: string,
  ) {
    const item = await this.prisma.checklistItem.findFirst({
      where: { id: itemId, taskId, task: { boardId } },
    });
    if (!item) throw new NotFoundException('Checklist item not found');
  }

  private async assertGoalInBoard(boardId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, boardId },
    });
    if (!goal) throw new BadRequestException('Unknown goal for this board');
  }

  private async assertEventInBoard(boardId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, boardId },
    });
    if (!event) throw new BadRequestException('Unknown event for this board');
  }

  private async assertStatusInBoard(boardId: string, statusId: string) {
    const status = await this.prisma.taskStatus.findFirst({
      where: { id: statusId, boardId },
    });
    if (!status) throw new BadRequestException('Unknown status for this board');
  }

  private async defaultStatusId(boardId: string): Promise<string> {
    const status = await this.prisma.taskStatus.findFirst({
      where: { boardId },
      orderBy: { sortOrder: 'asc' },
    });
    if (!status) throw new BadRequestException('Board has no statuses');
    return status.id;
  }

  private toDto = (task: {
    id: string;
    boardId: string;
    title: string;
    description: string | null;
    priority: string;
    statusId: string;
    dueDate: Date | null;
    sortOrder: number;
    parentTaskId: string | null;
    createdAt: Date;
    updatedAt: Date;
    status: { id: string; name: string; color: string; isDone: boolean };
    goal: { id: string; title: string } | null;
    event: {
      id: string;
      title: string;
      type: string;
      startsAt: Date;
    } | null;
    assignees: {
      user: { id: string; displayName: string; avatarUrl: string | null };
    }[];
    checklist?: { id: string; text: string; done: boolean }[];
    _count: { subtasks: number; checklist: number };
  }) => ({
    id: task.id,
    boardId: task.boardId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    statusId: task.statusId,
    status: {
      id: task.status.id,
      name: task.status.name,
      color: task.status.color,
      isDone: task.status.isDone,
    },
    dueDate: task.dueDate,
    sortOrder: task.sortOrder,
    parentTaskId: task.parentTaskId,
    goal: task.goal,
    event: task.event,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    assignees: task.assignees.map((a) => ({
      id: a.user.id,
      displayName: a.user.displayName,
      avatarUrl: a.user.avatarUrl,
    })),
    checklist: task.checklist ?? [],
    subtaskCount: task._count.subtasks,
    checklistCount: task._count.checklist,
  });
}
