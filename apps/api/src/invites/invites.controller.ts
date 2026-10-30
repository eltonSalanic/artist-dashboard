import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { createInviteSchema, type CreateInviteDto } from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SkipSubscription } from '../billing/skip-subscription.decorator';
import { InvitesService } from './invites.service';

/**
 * Open on a locked band: joining never costs anything, and an admin can line
 * people up while the owner sorts out their subscription.
 */
@Controller('boards/:boardId/invites')
@BoardRoles('ADMIN')
@SkipSubscription()
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post()
  create(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createInviteSchema)) dto: CreateInviteDto,
  ) {
    return this.invites.create(boardId, user.userId, dto);
  }

  @Get()
  list(@Param('boardId') boardId: string) {
    return this.invites.list(boardId);
  }

  @Delete(':inviteId')
  remove(
    @Param('boardId') boardId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.invites.remove(boardId, inviteId);
  }
}
