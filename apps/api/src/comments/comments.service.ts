import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BoardRole,
  CreateCommentDto,
  UpdateCommentDto,
} from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { StorageService } from '../attachments/storage.service';

const commentInclude = {
  author: { select: { id: true, displayName: true, avatarUrl: true } },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
    include: { uploadedBy: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.CommentInclude;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
  ) {}

  async list(boardId: string, taskId: string) {
    await this.assertTaskInBoard(boardId, taskId);
    const comments = await this.prisma.comment.findMany({
      where: { boardId, taskId },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
    });
    return comments.map(toDto);
  }

  async create(
    boardId: string,
    taskId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    const task = await this.assertTaskInBoard(boardId, taskId);
    await this.assertMentionsAreMembers(boardId, dto.mentions);

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          boardId,
          taskId,
          authorId: userId,
          body: dto.body,
          mentions: dto.mentions,
        },
        include: commentInclude,
      });
      await this.activity.log(tx, {
        boardId,
        type: 'COMMENT_ADDED',
        actorId: userId,
        meta: {
          commentId: comment.id,
          taskId,
          taskTitle: task.title,
          excerpt: excerpt(comment.body),
          mentions: dto.mentions,
        },
      });
      await this.notifyMentions(tx, {
        boardId,
        taskId,
        taskTitle: task.title,
        actorName: comment.author.displayName,
        actorId: userId,
        excerpt: excerpt(comment.body),
        mentions: dto.mentions,
      });
      return toDto(comment);
    });
  }

  /**
   * Drops a "you were mentioned" notification for each mentioned member other
   * than the author. Fields are snapshotted so the row outlives the comment.
   */
  private async notifyMentions(
    tx: Prisma.TransactionClient,
    input: {
      boardId: string;
      taskId: string;
      taskTitle: string;
      actorName: string;
      actorId: string;
      excerpt: string;
      mentions: string[];
    },
  ) {
    const recipients = input.mentions.filter((id) => id !== input.actorId);
    if (recipients.length === 0) return;
    await tx.mentionNotification.createMany({
      data: recipients.map((userId) => ({
        boardId: input.boardId,
        userId,
        taskId: input.taskId,
        taskTitle: input.taskTitle,
        actorName: input.actorName,
        excerpt: input.excerpt,
      })),
    });
  }

  /** Editing is author-only — an admin may delete, but never rewrite. */
  async update(
    boardId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    const existing = await this.getOwned(boardId, commentId);
    if (existing.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    if (dto.mentions)
      await this.assertMentionsAreMembers(boardId, dto.mentions);

    const comment = await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        body: dto.body,
        ...(dto.mentions ? { mentions: dto.mentions } : {}),
        editedAt: new Date(),
      },
      include: commentInclude,
    });
    return toDto(comment);
  }

  async remove(
    boardId: string,
    commentId: string,
    userId: string,
    role: BoardRole,
  ) {
    const comment = await this.getOwned(boardId, commentId);
    if (role !== 'ADMIN' && comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    // Attachment rows cascade with the comment; their objects do not, so they
    // are collected before the delete and purged after it.
    const attachments = await this.prisma.attachment.findMany({
      where: { commentId },
      select: { storagePath: true },
    });
    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.storage.remove(attachments.map((a) => a.storagePath));
    return { deleted: true };
  }

  private async getOwned(boardId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, boardId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  private async assertTaskInBoard(boardId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, boardId },
      select: { id: true, title: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async assertMentionsAreMembers(boardId: string, mentions: string[]) {
    if (mentions.length === 0) return;
    const members = await this.prisma.membership.findMany({
      where: { boardId, userId: { in: mentions } },
      select: { userId: true },
    });
    const known = new Set(members.map((m) => m.userId));
    if (mentions.some((id) => !known.has(id))) {
      throw new BadRequestException('You can only mention board members');
    }
  }
}

function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat;
}

function toDto(comment: {
  id: string;
  taskId: string;
  body: string;
  mentions: string[];
  editedAt: Date | null;
  createdAt: Date;
  author: { id: string; displayName: string; avatarUrl: string | null };
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    createdAt: Date;
    uploadedBy: { id: string; displayName: string };
  }[];
}) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    body: comment.body,
    mentions: comment.mentions,
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
    author: comment.author,
    attachments: comment.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
      uploadedBy: a.uploadedBy,
    })),
  };
}
