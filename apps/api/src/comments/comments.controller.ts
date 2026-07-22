import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  createCommentSchema,
  updateCommentSchema,
  type BoardRole,
  type CreateCommentDto,
  type UpdateCommentDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CommentsService } from './comments.service';

interface RequestWithMembership {
  membership: { role: BoardRole };
}

/**
 * Commenting is a member-level action (`task.comment`). Ownership rules —
 * edit-own, delete-own-or-admin — live in the service.
 */
@Controller('boards/:boardId')
@BoardRoles('USER')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('tasks/:taskId/comments')
  list(@Param('boardId') boardId: string, @Param('taskId') taskId: string) {
    return this.comments.list(boardId, taskId);
  }

  @Post('tasks/:taskId/comments')
  create(
    @Param('boardId') boardId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createCommentSchema)) dto: CreateCommentDto,
  ) {
    return this.comments.create(boardId, taskId, user.userId, dto);
  }

  @Patch('comments/:commentId')
  update(
    @Param('boardId') boardId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateCommentSchema)) dto: UpdateCommentDto,
  ) {
    return this.comments.update(boardId, commentId, user.userId, dto);
  }

  @Delete('comments/:commentId')
  remove(
    @Param('boardId') boardId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.comments.remove(
      boardId,
      commentId,
      user.userId,
      req.membership.role,
    );
  }
}
