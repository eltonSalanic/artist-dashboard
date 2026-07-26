import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  archiveActionSchema,
  archiveKindSchema,
  archiveQuerySchema,
  type ArchiveActionDto,
  type ArchiveKind,
  type ArchiveQueryDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ArchiveService } from './archive.service';

@Controller('boards/:boardId/archive')
@BoardRoles('USER')
export class ArchiveController {
  constructor(private readonly archive: ArchiveService) {}

  /** Browsing the archive is open to every member; changing it is not. */
  @Get()
  list(
    @Param('boardId') boardId: string,
    @Query(new ZodValidationPipe(archiveQuerySchema)) query: ArchiveQueryDto,
  ) {
    return this.archive.list(boardId, query);
  }

  @Post(':kind/:id')
  @BoardRoles('ADMIN')
  archiveItem(
    @Param('boardId') boardId: string,
    @Param('kind', new ZodValidationPipe(archiveKindSchema)) kind: ArchiveKind,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(archiveActionSchema)) dto: ArchiveActionDto,
  ) {
    return this.archive.archive(boardId, kind, id, dto);
  }

  @Post(':kind/:id/restore')
  @BoardRoles('ADMIN')
  restoreItem(
    @Param('boardId') boardId: string,
    @Param('kind', new ZodValidationPipe(archiveKindSchema)) kind: ArchiveKind,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(archiveActionSchema)) dto: ArchiveActionDto,
  ) {
    return this.archive.restore(boardId, kind, id, dto);
  }
}
