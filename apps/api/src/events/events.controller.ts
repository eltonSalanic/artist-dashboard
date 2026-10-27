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
  cascadeQuerySchema,
  changeShowStatusSchema,
  createEventSchema,
  eventQuerySchema,
  updateEventSchema,
  type BoardRole,
  type CascadeQueryDto,
  type ChangeShowStatusDto,
  type CreateEventDto,
  type EventQueryDto,
  type UpdateEventDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EventsService } from './events.service';

interface RequestWithMembership {
  membership: { role: BoardRole };
}

@Controller('boards/:boardId/events')
@BoardRoles('USER')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(
    @Param('boardId') boardId: string,
    @Query(new ZodValidationPipe(eventQuerySchema)) query: EventQueryDto,
  ) {
    return this.events.list(boardId, query);
  }

  @Get(':eventId')
  findOne(
    @Param('boardId') boardId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.events.findOne(boardId, eventId);
  }

  @Post()
  @BoardRoles('ADMIN')
  create(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(createEventSchema)) dto: CreateEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.events.create(boardId, dto, user.userId);
  }

  @Patch(':eventId')
  @BoardRoles('ADMIN')
  update(
    @Param('boardId') boardId: string,
    @Param('eventId') eventId: string,
    @Body(new ZodValidationPipe(updateEventSchema)) dto: UpdateEventDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.events.update(boardId, eventId, dto, user.userId);
  }

  /** Open to members; the service checks 'show.changeStatus'. */
  @Patch(':eventId/status')
  changeStatus(
    @Param('boardId') boardId: string,
    @Param('eventId') eventId: string,
    @Body(new ZodValidationPipe(changeShowStatusSchema))
    dto: ChangeShowStatusDto,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.events.changeStatus(
      boardId,
      eventId,
      dto,
      user.userId,
      req.membership.role,
    );
  }

  @Delete(':eventId')
  @BoardRoles('ADMIN')
  remove(
    @Param('boardId') boardId: string,
    @Param('eventId') eventId: string,
    @Query(new ZodValidationPipe(cascadeQuerySchema)) query: CascadeQueryDto,
  ) {
    return this.events.remove(boardId, eventId, query.cascadeTasks);
  }
}
