import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AttachmentQueryDto,
  BoardRole,
  CreateAttachmentDto,
  UploadUrlDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { StorageService } from './storage.service';

const attachmentInclude = {
  uploadedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.AttachmentInclude;

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async list(boardId: string, query: AttachmentQueryDto) {
    if (!query.taskId && !query.commentId) {
      throw new BadRequestException('Pass a taskId or a commentId');
    }
    const rows = await this.prisma.attachment.findMany({
      where: {
        boardId,
        ...(query.taskId ? { taskId: query.taskId } : {}),
        ...(query.commentId ? { commentId: query.commentId } : {}),
      },
      include: attachmentInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDto);
  }

  createUploadUrl(boardId: string, dto: UploadUrlDto) {
    return this.storage.createUploadUrl(boardId, dto.fileName);
  }

  async create(boardId: string, userId: string, dto: CreateAttachmentDto) {
    // The path was minted by createUploadUrl under this board's prefix; a
    // client-supplied path pointing elsewhere would reach another board's files.
    if (!dto.storagePath.startsWith(`${boardId}/`)) {
      throw new BadRequestException(
        'Upload path does not belong to this board',
      );
    }

    const parentTitle = dto.taskId
      ? await this.assertTaskInBoard(boardId, dto.taskId)
      : await this.assertCommentInBoard(boardId, dto.commentId!);

    return this.prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          boardId,
          storagePath: dto.storagePath,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          size: dto.size,
          taskId: dto.taskId ?? null,
          commentId: dto.commentId ?? null,
          uploadedById: userId,
        },
        include: attachmentInclude,
      });
      await this.activity.log(tx, {
        boardId,
        type: 'FILE_UPLOADED',
        actorId: userId,
        meta: {
          attachmentId: attachment.id,
          fileName: attachment.fileName,
          taskId: dto.taskId ?? null,
          taskTitle: parentTitle,
        },
      });
      return toDto(attachment);
    });
  }

  async downloadUrl(boardId: string, attachmentId: string) {
    const attachment = await this.getOwned(boardId, attachmentId);
    return this.storage.createDownloadUrl(
      attachment.storagePath,
      attachment.fileName,
    );
  }

  async viewUrl(boardId: string, attachmentId: string) {
    const attachment = await this.getOwned(boardId, attachmentId);
    const { url, expiresIn } = await this.storage.createViewUrl(
      attachment.storagePath,
    );
    // The client renders by type, so it needs the stored content-type back.
    return { url, expiresIn, mimeType: attachment.mimeType };
  }

  async remove(
    boardId: string,
    attachmentId: string,
    userId: string,
    role: BoardRole,
  ) {
    const attachment = await this.getOwned(boardId, attachmentId);
    if (role !== 'ADMIN' && attachment.uploadedById !== userId) {
      throw new ForbiddenException('You can only delete your own uploads');
    }
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await this.storage.remove([attachment.storagePath]);
    return { deleted: true };
  }

  private async getOwned(boardId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, boardId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  /** Returns the task title so the activity entry can name it. */
  private async assertTaskInBoard(boardId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, boardId },
      select: { title: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task.title;
  }

  private async assertCommentInBoard(boardId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, boardId },
      select: { task: { select: { title: true } } },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment.task.title;
  }
}

function toDto(attachment: {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  taskId: string | null;
  commentId: string | null;
  createdAt: Date;
  uploadedBy: { id: string; displayName: string };
}) {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    taskId: attachment.taskId,
    commentId: attachment.commentId,
    createdAt: attachment.createdAt,
    uploadedBy: attachment.uploadedBy,
  };
}
