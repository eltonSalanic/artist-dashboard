import { Controller, Delete, Get, Param } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { MentionsService } from './mentions.service';

/**
 * A member's own "you were mentioned" notifications. Every route is scoped to
 * the current user, so a member only ever sees or clears their own.
 */
@Controller('boards/:boardId/mentions')
@BoardRoles('USER')
export class MentionsController {
  constructor(private readonly mentions: MentionsService) {}

  @Get()
  list(@Param('boardId') boardId: string, @CurrentUser() user: AuthUser) {
    return this.mentions.list(boardId, user.userId);
  }

  @Delete()
  clear(@Param('boardId') boardId: string, @CurrentUser() user: AuthUser) {
    return this.mentions.clear(boardId, user.userId);
  }

  @Delete(':id')
  remove(
    @Param('boardId') boardId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.mentions.remove(boardId, user.userId, id);
  }
}
