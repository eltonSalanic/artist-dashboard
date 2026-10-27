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
  createShowStatusSchema,
  updateShowStatusSchema,
  type CreateShowStatusDto,
  type UpdateShowStatusDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ShowStatusesService } from './show-statuses.service';

@Controller('boards/:boardId/show-statuses')
export class ShowStatusesController {
  constructor(private readonly statuses: ShowStatusesService) {}

  @Get()
  @BoardRoles('USER')
  list(@Param('boardId') boardId: string) {
    return this.statuses.list(boardId);
  }

  @Post()
  @BoardRoles('ADMIN')
  create(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(createShowStatusSchema)) dto: CreateShowStatusDto,
  ) {
    return this.statuses.create(boardId, dto);
  }

  @Patch(':statusId')
  @BoardRoles('ADMIN')
  update(
    @Param('boardId') boardId: string,
    @Param('statusId') statusId: string,
    @Body(new ZodValidationPipe(updateShowStatusSchema)) dto: UpdateShowStatusDto,
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
