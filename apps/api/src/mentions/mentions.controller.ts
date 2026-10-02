import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  boardFilterQuerySchema,
  type BoardFilterQueryDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { UserBoards } from '../common/user-boards.decorator';
import { UserBoardsGuard } from '../common/user-boards.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MentionsService } from './mentions.service';
import { narrowToBoard } from '../common/narrow-to-board';

/**
 * One board's mentions. Every route is scoped to the current user, so a member
 * only ever sees or clears their own.
 */
@Controller('boards/:boardId/mentions')
@BoardRoles('USER')
export class MentionsController {
  constructor(private readonly mentions: MentionsService) {}

  @Get()
  list(@Param('boardId') boardId: string, @CurrentUser() user: AuthUser) {
    return this.mentions.list([boardId], user.userId);
  }

  @Delete()
  clear(@Param('boardId') boardId: string, @CurrentUser() user: AuthUser) {
    return this.mentions.clear([boardId], user.userId);
  }

  @Delete(':id')
  remove(
    @Param('boardId') boardId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.mentions.remove([boardId], user.userId, id);
  }
}

/**
 * The caller's mentions across every board they belong to — the mobile inbox.
 *
 * **No `@BoardRoles`, because there is no board id in the path for it to
 * check.** `UserBoardsGuard` plus `@UserBoards()` replace it, and that board
 * list is the entire tenancy boundary. See `MentionsService`'s own comment for
 * why filtering by `userId` alone would have been a content leak rather than
 * merely incomplete.
 */
@Controller('mentions')
@UseGuards(UserBoardsGuard)
export class CrossBoardMentionsController {
  constructor(private readonly mentions: MentionsService) {}

  @Get()
  list(
    @UserBoards() boardIds: string[],
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(boardFilterQuerySchema))
    query: BoardFilterQueryDto,
  ) {
    return this.mentions.list(
      narrowToBoard(boardIds, query.boardId),
      user.userId,
    );
  }

  /**
   * Clears the caller's mentions — across every board by default, or one board
   * when `?boardId=` is given.
   *
   * The filter exists because of the blast radius: an unfiltered clear-all
   * wipes several bands' inboxes from one tap. The mobile inbox already has a
   * per-board filter, so "Clear all" while filtered should mean *this* band,
   * and the request says which it meant rather than the server guessing.
   */
  @Delete()
  clear(
    @UserBoards() boardIds: string[],
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(boardFilterQuerySchema))
    query: BoardFilterQueryDto,
  ) {
    return this.mentions.clear(
      narrowToBoard(boardIds, query.boardId),
      user.userId,
    );
  }

  @Delete(':id')
  remove(
    @UserBoards() boardIds: string[],
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.mentions.remove(boardIds, user.userId, id);
  }
}
