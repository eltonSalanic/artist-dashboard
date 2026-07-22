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
  attachmentQuerySchema,
  createAttachmentSchema,
  uploadUrlSchema,
  type AttachmentQueryDto,
  type BoardRole,
  type CreateAttachmentDto,
  type UploadUrlDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AttachmentsService } from './attachments.service';

interface RequestWithMembership {
  membership: { role: BoardRole };
}

/** Uploading is a member-level action (`file.upload`), not an admin one. */
@Controller('boards/:boardId/attachments')
@BoardRoles('USER')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  list(
    @Param('boardId') boardId: string,
    @Query(new ZodValidationPipe(attachmentQuerySchema))
    query: AttachmentQueryDto,
  ) {
    return this.attachments.list(boardId, query);
  }

  @Post('upload-url')
  createUploadUrl(
    @Param('boardId') boardId: string,
    @Body(new ZodValidationPipe(uploadUrlSchema)) dto: UploadUrlDto,
  ) {
    return this.attachments.createUploadUrl(boardId, dto);
  }

  @Post()
  create(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAttachmentSchema))
    dto: CreateAttachmentDto,
  ) {
    return this.attachments.create(boardId, user.userId, dto);
  }

  @Get(':attachmentId/download-url')
  downloadUrl(
    @Param('boardId') boardId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.downloadUrl(boardId, attachmentId);
  }

  @Delete(':attachmentId')
  remove(
    @Param('boardId') boardId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.attachments.remove(
      boardId,
      attachmentId,
      user.userId,
      req.membership.role,
    );
  }
}
