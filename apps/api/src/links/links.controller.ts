import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  createItemLinkSchema,
  linkParentSchema,
  type BoardRole,
  type CreateItemLinkDto,
  type LinkParentDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LinksService } from './links.service';

interface RequestWithMembership {
  membership: { role: BoardRole };
}

@Controller('boards/:boardId/links')
@BoardRoles('USER')
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Get()
  list(
    @Param('boardId') boardId: string,
    @Query(new ZodValidationPipe(linkParentSchema)) parent: LinkParentDto,
  ) {
    return this.links.list(boardId, parent);
  }

  @Post()
  create(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(createItemLinkSchema)) dto: CreateItemLinkDto,
  ) {
    return this.links.create(boardId, user.userId, req.membership.role, dto);
  }

  @Delete(':linkId')
  remove(
    @Param('boardId') boardId: string,
    @Param('linkId') linkId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.links.remove(boardId, linkId, user.userId, req.membership.role);
  }
}
