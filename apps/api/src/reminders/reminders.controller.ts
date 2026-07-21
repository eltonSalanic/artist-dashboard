import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  createReminderSchema,
  updateReminderSchema,
  type CreateReminderDto,
  type UpdateReminderDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RemindersService } from './reminders.service';

@Controller('boards/:boardId/reminders')
@BoardRoles('USER')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(@Param('boardId') boardId: string) {
    return this.reminders.list(boardId);
  }

  @Post()
  @BoardRoles('ADMIN')
  create(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(createReminderSchema)) dto: CreateReminderDto,
  ) {
    return this.reminders.create(boardId, dto);
  }

  @Patch(':reminderId')
  @BoardRoles('ADMIN')
  update(
    @Param('boardId') boardId: string,
    @Param('reminderId') reminderId: string,
    @Body(new ZodValidationPipe(updateReminderSchema)) dto: UpdateReminderDto,
  ) {
    return this.reminders.update(boardId, reminderId, dto);
  }

  @Delete(':reminderId')
  @BoardRoles('ADMIN')
  remove(
    @Param('boardId') boardId: string,
    @Param('reminderId') reminderId: string,
  ) {
    return this.reminders.remove(boardId, reminderId);
  }
}
