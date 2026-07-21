import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { updateLayoutSchema, type UpdateLayoutDto } from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LayoutsService } from './layouts.service';

@Controller('boards/:boardId')
export class LayoutsController {
  constructor(private readonly layouts: LayoutsService) {}

  @Get('layout')
  @BoardRoles('USER')
  get(@Param('boardId') boardId: string, @CurrentUser() user: AuthUser) {
    return this.layouts.getForUser(boardId, user.userId);
  }

  @Put('layout')
  @BoardRoles('USER')
  update(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateLayoutSchema)) dto: UpdateLayoutDto,
  ) {
    return this.layouts.saveForUser(boardId, user.userId, dto);
  }

  @Put('default-layout')
  @BoardRoles('ADMIN')
  updateDefault(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(updateLayoutSchema)) dto: UpdateLayoutDto,
  ) {
    return this.layouts.saveDefault(boardId, dto);
  }
}
