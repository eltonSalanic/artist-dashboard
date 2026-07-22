import { Controller, Get, Param, Query } from '@nestjs/common';
import { activityQuerySchema, type ActivityQueryDto } from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ActivityService } from './activity.service';

@Controller('boards/:boardId/activity')
@BoardRoles('USER')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  feed(
    @Param('boardId') boardId: string,
    @Query(new ZodValidationPipe(activityQuerySchema)) query: ActivityQueryDto,
  ) {
    return this.activity.feed(boardId, query);
  }
}
