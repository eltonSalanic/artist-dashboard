import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  can,
  NOTE_EDIT_ACTION,
  type BoardRole,
  type CreateNoteDto,
  type NoteParentDto,
  type NoteParentKind,
  type UpdateNoteDto,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

const SORT_GAP = 1000;

const PARENT_COLUMN = {
  TASK: 'taskId',
  EVENT: 'eventId',
  GOAL: 'goalId',
  REMINDER: 'reminderId',
} as const satisfies Record<NoteParentKind, string>;

const NOTE_SELECT = {
  id: true,
  title: true,
  body: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(boardId: string, parent: NoteParentDto) {
    await this.assertParent(boardId, parent);
    return this.prisma.note.findMany({
      where: { boardId, [PARENT_COLUMN[parent.kind]]: parent.parentId },
      orderBy: { sortOrder: 'asc' },
      select: NOTE_SELECT,
    });
  }

  async create(boardId: string, role: BoardRole, dto: CreateNoteDto) {
    this.assertCanEdit(role, dto.kind);
    await this.assertParent(boardId, dto);
    const column = PARENT_COLUMN[dto.kind];
    const last = await this.prisma.note.aggregate({
      where: { [column]: dto.parentId },
      _max: { sortOrder: true },
    });
    return this.prisma.note.create({
      data: {
        boardId,
        [column]: dto.parentId,
        title: dto.title,
        body: dto.body,
        sortOrder: (last._max.sortOrder ?? 0) + SORT_GAP,
      },
      select: NOTE_SELECT,
    });
  }

  async update(
    boardId: string,
    noteId: string,
    role: BoardRole,
    dto: UpdateNoteDto,
  ) {
    await this.getEditable(boardId, noteId, role);
    return this.prisma.note.update({
      where: { id: noteId },
      data: dto,
      select: NOTE_SELECT,
    });
  }

  async remove(boardId: string, noteId: string, role: BoardRole) {
    await this.getEditable(boardId, noteId, role);
    await this.prisma.note.delete({ where: { id: noteId } });
    return { deleted: true };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private async getEditable(boardId: string, noteId: string, role: BoardRole) {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, boardId },
    });
    if (!note) throw new NotFoundException('Note not found');
    this.assertCanEdit(role, kindOf(note));
    return note;
  }

  private assertCanEdit(role: BoardRole, kind: NoteParentKind) {
    if (!can(role, NOTE_EDIT_ACTION[kind])) {
      throw new ForbiddenException("You can't edit notes on this item");
    }
  }

  private async assertParent(
    boardId: string,
    { kind, parentId }: NoteParentDto,
  ) {
    const where = { id: parentId, boardId };
    const found =
      kind === 'TASK'
        ? await this.prisma.task.findFirst({ where, select: { id: true } })
        : kind === 'EVENT'
          ? await this.prisma.event.findFirst({ where, select: { id: true } })
          : kind === 'GOAL'
            ? await this.prisma.goal.findFirst({ where, select: { id: true } })
            : await this.prisma.reminder.findFirst({
                where,
                select: { id: true },
              });
    if (!found) throw new NotFoundException('Item not found');
  }
}

function kindOf(note: {
  taskId: string | null;
  eventId: string | null;
  goalId: string | null;
}): NoteParentKind {
  if (note.taskId) return 'TASK';
  if (note.eventId) return 'EVENT';
  if (note.goalId) return 'GOAL';
  return 'REMINDER';
}
