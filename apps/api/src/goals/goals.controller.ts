import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  cascadeQuerySchema,
  createGoalSchema,
  goalQuerySchema,
  updateGoalSchema,
  type CascadeQueryDto,
  type CreateGoalDto,
  type GoalQueryDto,
  type UpdateGoalDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GoalsService } from './goals.service';

@Controller('boards/:boardId/goals')
@BoardRoles('USER')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(
    @Param('boardId') boardId: string,
    @Query(new ZodValidationPipe(goalQuerySchema)) query: GoalQueryDto,
  ) {
    return this.goals.list(boardId, query);
  }

  @Get(':goalId')
  findOne(@Param('boardId') boardId: string, @Param('goalId') goalId: string) {
    return this.goals.findOne(boardId, goalId);
  }

  @Post()
  @BoardRoles('ADMIN')
  create(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(createGoalSchema)) dto: CreateGoalDto,
  ) {
    return this.goals.create(boardId, dto);
  }

  @Patch(':goalId')
  @BoardRoles('ADMIN')
  update(
    @Param('boardId') boardId: string,
    @Param('goalId') goalId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateGoalSchema)) dto: UpdateGoalDto,
  ) {
    return this.goals.update(boardId, goalId, user.userId, dto);
  }

  @Delete(':goalId')
  @BoardRoles('ADMIN')
  remove(
    @Param('boardId') boardId: string,
    @Param('goalId') goalId: string,
    @Query(new ZodValidationPipe(cascadeQuerySchema)) query: CascadeQueryDto,
  ) {
    return this.goals.remove(boardId, goalId, query.cascadeTasks);
  }
}
