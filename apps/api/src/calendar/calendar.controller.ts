import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  calendarQuerySchema,
  crossBoardCalendarQuerySchema,
  type CalendarQueryDto,
  type CrossBoardCalendarQueryDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { UserBoards } from '../common/user-boards.decorator';
import { UserBoardsGuard } from '../common/user-boards.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { narrowToBoard } from '../common/narrow-to-board';
import { CalendarService } from './calendar.service';

/** One board's calendar. Guarded the ordinary way, by the `:boardId` in the path. */
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
    // A list of one. The guard has already confirmed membership on this id.
    return this.calendar.range([boardId], user.userId, query);
  }
}

/**
 * Every board the caller belongs to, merged into one range.
 *
 * **No `@BoardRoles` here, because there is no board id in the path for it to
 * check** — and with no metadata, `BoardRolesGuard` returns true immediately
 * without looking at anything. What replaces it is `UserBoardsGuard`, which
 * resolves the caller's membership set from the database, and `@UserBoards()`,
 * which refuses to hand the handler anything but an array. That list is the
 * entire tenancy boundary for this route.
 *
 * This and `GET /mentions` are the only board-touching routes in the API not
 * covered by `BoardRolesGuard`. Worth keeping that true, and worth re-reading
 * `CalendarService.range`'s own comment before changing either.
 */
@Controller('calendar')
@UseGuards(UserBoardsGuard)
export class CrossBoardCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  range(
    @UserBoards() boardIds: string[],
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(crossBoardCalendarQuerySchema))
    query: CrossBoardCalendarQueryDto,
  ) {
    // `?boardId=` narrows within the authorised set; it never replaces it, so
    // an id the caller does not belong to yields nothing.
    return this.calendar.range(
      narrowToBoard(boardIds, query.boardId),
      user.userId,
      query,
    );
  }
}
