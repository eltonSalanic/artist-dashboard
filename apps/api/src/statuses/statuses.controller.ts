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
  createStatusSchema,
  updateStatusSchema,
  type CreateStatusDto,
  type UpdateStatusDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { StatusesService } from './statuses.service';

@Controller('boards/:boardId/statuses')
export class StatusesController {
  constructor(private readonly statuses: StatusesService) {}

  @Get()
  @BoardRoles('USER')
  list(@Param('boardId') boardId: string) {
    return this.statuses.list(boardId);
  }

  @Post()
  @BoardRoles('ADMIN')
  create(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(createStatusSchema)) dto: CreateStatusDto,
  ) {
    return this.statuses.create(boardId, dto);
  }

  @Patch(':statusId')
  @BoardRoles('ADMIN')
  update(
    @Param('boardId') boardId: string,
    @Param('statusId') statusId: string,
    @Body(new ZodValidationPipe(updateStatusSchema)) dto: UpdateStatusDto,
  ) {
    return this.statuses.update(boardId, statusId, dto);
  }

  @Delete(':statusId')
  @BoardRoles('ADMIN')
  remove(
    @Param('boardId') boardId: string,
    @Param('statusId') statusId: string,
  ) {
    return this.statuses.remove(boardId, statusId);
  }
}
