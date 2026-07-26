import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateGoalDto,
  GoalQueryDto,
  UpdateGoalDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

const goalInclude = {
  // Archived tasks belong to the archive page, not to their goal's count —
  // this is also the number the "also archive N tasks" prompt shows.
  _count: { select: { tasks: { where: { archivedAt: null } } } },
} satisfies Prisma.GoalInclude;

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async list(boardId: string, query: GoalQueryDto) {
    const goals = await this.prisma.goal.findMany({
      where: {
        boardId,
        archivedAt: null,
        ...(query.period ? { period: query.period } : {}),
        ...(query.includeCompleted ? {} : { completedAt: null }),
      },
      include: goalInclude,
      orderBy: [
        { period: 'asc' }, // enum order: YEARLY, MONTHLY, DAILY
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
    return goals.map(this.toDto);
  }

  /** Archived goals stay fetchable — the archive page opens this same detail. */
  async findOne(boardId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, boardId },
      include: goalInclude,
    });
    if (!goal) throw new NotFoundException('Goal not found');
    // How many tasks went down with this goal — the "also restore" prompt.
    const archivedTaskCount = await this.prisma.task.count({
      where: { boardId, archivedWithId: goalId },
    });
    return { ...this.toDto(goal), archivedTaskCount };
  }

  async create(boardId: string, dto: CreateGoalDto) {
    const goal = await this.prisma.goal.create({
      data: {
        boardId,
        title: dto.title,
        description: dto.description,
        period: dto.period,
        dueDate: dto.dueDate ?? null,
      },
      include: goalInclude,
    });
    return this.toDto(goal);
  }

  async update(
    boardId: string,
    goalId: string,
    actorId: string,
    dto: UpdateGoalDto,
  ) {
    const existing = await this.prisma.goal.findFirst({
      where: { id: goalId, boardId },
    });
    if (!existing) throw new NotFoundException('Goal not found');

    const { completed, ...fields } = dto;
    const goal = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.goal.update({
        where: { id: goalId },
        data: {
          ...fields,
          ...(completed === undefined
            ? {}
            : {
                completedAt: completed
                  ? (existing.completedAt ?? new Date())
                  : null,
              }),
        },
        include: goalInclude,
      });
      // Only the first completion is news; re-completing keeps the original
      // timestamp and doesn't repeat itself in the feed.
      if (completed && existing.completedAt === null) {
        await this.activity.log(tx, {
          boardId,
          type: 'GOAL_COMPLETED',
          actorId,
          meta: {
            goalId,
            goalTitle: updated.title,
            period: updated.period,
          },
        });
      }
      return updated;
    });
    return this.toDto(goal);
  }

  async remove(boardId: string, goalId: string) {
    await this.findOne(boardId, goalId);
    await this.prisma.goal.delete({ where: { id: goalId } });
    return { deleted: true };
  }

  private toDto = (goal: {
    id: string;
    boardId: string;
    title: string;
    description: string | null;
    period: string;
    dueDate: Date | null;
    completedAt: Date | null;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { tasks: number };
  }) => ({
    id: goal.id,
    boardId: goal.boardId,
    title: goal.title,
    description: goal.description,
    period: goal.period,
    dueDate: goal.dueDate,
    completedAt: goal.completedAt,
    archivedAt: goal.archivedAt,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    taskCount: goal._count.tasks,
  });
}
