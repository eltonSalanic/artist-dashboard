import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  createNoteSchema,
  noteParentSchema,
  updateNoteSchema,
  type BoardRole,
  type CreateNoteDto,
  type NoteParentDto,
  type UpdateNoteDto,
} from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { NotesService } from './notes.service';

interface RequestWithMembership {
  membership: { role: BoardRole };
}

/**
 * Titled notes on a task, event, goal or reminder. Anyone in the band reads
 * them; writing needs the same permission as editing the item itself.
 */
@Controller('boards/:boardId/notes')
@BoardRoles('USER')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(
    @Param('boardId') boardId: string,
    @Query(new ZodValidationPipe(noteParentSchema)) parent: NoteParentDto,
  ) {
    return this.notes.list(boardId, parent);
  }

  @Post()
  create(
    @Param('boardId') boardId: string,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(createNoteSchema)) dto: CreateNoteDto,
  ) {
    return this.notes.create(boardId, req.membership.role, dto);
  }

  @Patch(':noteId')
  update(
    @Param('boardId') boardId: string,
    @Param('noteId') noteId: string,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(updateNoteSchema)) dto: UpdateNoteDto,
  ) {
    return this.notes.update(boardId, noteId, req.membership.role, dto);
  }

  @Delete(':noteId')
  remove(
    @Param('boardId') boardId: string,
    @Param('noteId') noteId: string,
    @Req() req: RequestWithMembership,
  ) {
    return this.notes.remove(boardId, noteId, req.membership.role);
  }
}
