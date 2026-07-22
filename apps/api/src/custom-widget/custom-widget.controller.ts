import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  updateCustomWidgetSchema,
  type UpdateCustomWidgetDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CustomWidgetService } from './custom-widget.service';

@Controller('boards/:boardId/custom-widget')
@BoardRoles('USER')
export class CustomWidgetController {
  constructor(private readonly customWidget: CustomWidgetService) {}

  @Get()
  get(@Param('boardId') boardId: string) {
    return this.customWidget.get(boardId);
  }

  /** One shared note per board, so editing it is a `widget.manage` action. */
  @Put()
  @BoardRoles('ADMIN')
  set(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(updateCustomWidgetSchema))
    dto: UpdateCustomWidgetDto,
  ) {
    return this.customWidget.set(boardId, dto);
  }
}
