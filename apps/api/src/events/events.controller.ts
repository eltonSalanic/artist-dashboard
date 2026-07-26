import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  cascadeQuerySchema,
  createEventSchema,
  eventQuerySchema,
  updateEventSchema,
  type CascadeQueryDto,
  type CreateEventDto,
  type EventQueryDto,
  type UpdateEventDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EventsService } from './events.service';

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
  ) {
    return this.events.create(boardId, dto);
  }

  @Patch(':eventId')
  @BoardRoles('ADMIN')
  update(
    @Param('boardId') boardId: string,
    @Param('eventId') eventId: string,
    @Body(new ZodValidationPipe(updateEventSchema)) dto: UpdateEventDto,
  ) {
    return this.events.update(boardId, eventId, dto);
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
