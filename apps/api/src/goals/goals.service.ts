import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateGoalDto,
  GoalQueryDto,
  UpdateGoalDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { TasksService } from '../tasks/tasks.service';
import { countOpen } from '../tasks/open-subtasks';

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
    private readonly tasks: TasksService,
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
    const open = await this.openTaskCounts(goals.map((goal) => goal.id));
    return goals.map((goal) => this.toDto(goal, open.get(goal.id) ?? 0));
  }

  /** Archived goals stay fetchable — the archive page opens this same detail. */
  async findOne(boardId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, boardId },
      include: goalInclude,
    });
    if (!goal) throw new NotFoundException('Goal not found');
    const [archivedTaskCount, linkedTaskCount, open] = await Promise.all([
      // What went down with this goal — the "also restore" prompt.
      this.prisma.task.count({ where: { boardId, archivedWithId: goalId } }),
      // Everything a cascading delete would take, archived or not.
      this.prisma.task.count({ where: { boardId, goalId } }),
      this.openTaskCounts([goalId]),
    ]);
    return {
      ...this.toDto(goal, open.get(goalId) ?? 0),
      archivedTaskCount,
      linkedTaskCount,
    };
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
    return this.toDto(goal, 0);
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
        // Completing a goal always finishes its open tasks — there is no
        // "complete the goal only". The clients say so before asking.
        await this.tasks.completeForGoal(tx, boardId, goalId, actorId);
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
    const open = await this.openTaskCounts([goalId]);
    return this.toDto(goal, open.get(goalId) ?? 0);
  }

  /**
   * With `cascadeTasks`, the goal's tasks are deleted with it (attachments and
   * all). Without it they survive and `Task.goalId` is nulled by the database.
   */
  async remove(boardId: string, goalId: string, cascadeTasks = false) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, boardId },
    });
    if (!goal) throw new NotFoundException('Goal not found');

    if (cascadeTasks) {
      // Every linked task at any depth — a subtask can carry its own goalId.
      const linked = await this.prisma.task.findMany({
        where: { boardId, goalId },
        select: { id: true },
      });
      await this.tasks.removeMany(
        boardId,
        linked.map((t) => t.id),
      );
    }

    await this.prisma.goal.delete({ where: { id: goalId } });
    return { deleted: true };
  }

  /**
   * Live tasks not yet done, per goal, counting open subtasks under its tasks:
   * what completing the goal will finish, which the clients' confirmation
   * names before asking. Subtasks nest two levels, so two levels are read.
   */
  private async openTaskCounts(
    goalIds: string[],
  ): Promise<Map<string, number>> {
    if (goalIds.length === 0) return new Map();
    const live = { archivedAt: null };
    const status = { select: { isDone: true } };
    const linked = await this.prisma.task.findMany({
      where: { goalId: { in: goalIds }, ...live },
      select: {
        goalId: true,
        status,
        subtasks: {
          where: live,
          select: {
            status,
            subtasks: { where: live, select: { status } },
          },
        },
      },
    });
    const counts = new Map<string, number>();
    for (const task of linked) {
      const goalId = task.goalId as string;
      counts.set(goalId, (counts.get(goalId) ?? 0) + countOpen([task]));
    }
    return counts;
  }

  private toDto = (
    goal: {
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
    },
    openTaskCount: number,
  ) => ({
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
    openTaskCount,
  });
}
