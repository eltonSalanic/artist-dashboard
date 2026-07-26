import { Controller, Get, Param, Query } from '@nestjs/common';
import { calendarQuerySchema, type CalendarQueryDto } from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CalendarService } from './calendar.service';

@Controller('boards/:boardId/calendar')
@BoardRoles('USER')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  range(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(calendarQuerySchema)) query: CalendarQueryDto,
  ) {
    return this.calendar.range(boardId, user.userId, query);
  }
}
