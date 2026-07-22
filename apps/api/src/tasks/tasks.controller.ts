import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  createChecklistItemSchema,
  createTaskSchema,
  reorderTaskSchema,
  setAssigneesSchema,
  taskQuerySchema,
  updateChecklistItemSchema,
  updateTaskSchema,
  type CreateChecklistItemDto,
  type CreateTaskDto,
  type ReorderTaskDto,
  type SetAssigneesDto,
  type TaskQueryDto,
  type UpdateChecklistItemDto,
  type UpdateTaskDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TasksService } from './tasks.service';

interface RequestWithMembership {
  membership: { role: 'ADMIN' | 'USER' };
}

@Controller('boards/:boardId/tasks')
@BoardRoles('USER')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Param('boardId') boardId: string,
    @Query(new ZodValidationPipe(taskQuerySchema)) query: TaskQueryDto,
  ) {
    return this.tasks.list(boardId, query);
  }

  @Get(':taskId')
  findOne(@Param('boardId') boardId: string, @Param('taskId') taskId: string) {
    return this.tasks.findOne(boardId, taskId);
  }

  @Post()
  create(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(createTaskSchema)) dto: CreateTaskDto,
  ) {
    return this.tasks.create(boardId, user.userId, req.membership.role, dto);
  }

  @Patch(':taskId')
  update(
    @Param('boardId') boardId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(updateTaskSchema)) dto: UpdateTaskDto,
  ) {
    return this.tasks.update(
      boardId,
      taskId,
      user.userId,
      req.membership.role,
      dto,
    );
  }

  @Delete(':taskId')
  @BoardRoles('ADMIN')
  remove(@Param('boardId') boardId: string, @Param('taskId') taskId: string) {
    return this.tasks.remove(boardId, taskId);
  }

  @Patch(':taskId/reorder')
  @BoardRoles('ADMIN')
  reorder(
    @Param('boardId') boardId: string,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(reorderTaskSchema)) dto: ReorderTaskDto,
  ) {
    return this.tasks.reorder(boardId, taskId, dto);
  }

  @Patch(':taskId/assignees')
  @BoardRoles('ADMIN')
  setAssignees(
    @Param('boardId') boardId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(setAssigneesSchema)) dto: SetAssigneesDto,
  ) {
    return this.tasks.setAssignees(boardId, taskId, user.userId, dto);
  }

  @Post(':taskId/checklist')
  addChecklistItem(
    @Param('boardId') boardId: string,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(createChecklistItemSchema))
    dto: CreateChecklistItemDto,
  ) {
    return this.tasks.addChecklistItem(boardId, taskId, dto);
  }

  @Patch(':taskId/checklist/:itemId')
  updateChecklistItem(
    @Param('boardId') boardId: string,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(updateChecklistItemSchema))
    dto: UpdateChecklistItemDto,
  ) {
    return this.tasks.updateChecklistItem(boardId, taskId, itemId, dto);
  }

  @Delete(':taskId/checklist/:itemId')
  removeChecklistItem(
    @Param('boardId') boardId: string,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.tasks.removeChecklistItem(boardId, taskId, itemId);
  }
}
