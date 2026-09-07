import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  updateNotificationPreferenceSchema,
  type UpdateNotificationPreferenceDto,
} from '@artist/shared';
import { Public } from '../auth/public.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { NotificationsService } from './notifications.service';
import { UnsubscribeService } from './unsubscribe.service';

/**
 * Public, and POST-only on purpose. RFC 8058 one-click unsubscribe posts here
 * with no session, and a *GET* that unsubscribed would be a trap: link
 * scanners and mail-client prefetchers follow every URL in a message, and
 * would quietly turn people's email off for them.
 */
@Controller('unsubscribe')
@Public()
export class UnsubscribeController {
  constructor(private readonly unsubscribes: UnsubscribeService) {}

  @Post()
  unsubscribe(@Query('token') token: string) {
    return this.unsubscribes.unsubscribe(token ?? '');
  }
}

/** Own preferences only. Membership is the whole gate — there is nothing here
 * an admin should be able to change on someone else's behalf. */
@Controller('boards/:boardId/notification-preferences')
@BoardRoles('USER')
export class NotificationPreferencesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  get(@Param('boardId') boardId: string, @CurrentUser() user: AuthUser) {
    return this.notifications.preferences(boardId, user.userId);
  }

  @Put()
  update(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateNotificationPreferenceSchema))
    dto: UpdateNotificationPreferenceDto,
  ) {
    return this.notifications.setPreference(
      boardId,
      user.userId,
      dto.category,
      dto.enabled,
    );
  }
}
