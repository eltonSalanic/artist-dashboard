import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  focusPeriodSchema,
  setFocusSchema,
  type FocusPeriod,
  type SetFocusDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FocusService } from './focus.service';

@Controller('boards/:boardId/focus')
export class FocusController {
  constructor(private readonly focus: FocusService) {}

  @Get()
  @BoardRoles('USER')
  list(@Param('boardId') boardId: string) {
    return this.focus.list(boardId);
  }

  @Put(':period')
  @BoardRoles('ADMIN')
  set(
    @Param('boardId') boardId: string,
    @Param('period', new ZodValidationPipe(focusPeriodSchema))
    period: FocusPeriod,
    @Body(new ZodValidationPipe(setFocusSchema)) dto: SetFocusDto,
  ) {
    return this.focus.set(boardId, period, dto);
  }
}
