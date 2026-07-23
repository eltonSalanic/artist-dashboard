import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MentionNotificationDto {
  id: string;
  taskId: string;
  actorName: string;
  taskTitle: string;
  excerpt: string;
  createdAt: Date;
}

@Injectable()
export class MentionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The recipient's mention notifications, most recent first. */
  async list(
    boardId: string,
    userId: string,
  ): Promise<MentionNotificationDto[]> {
    const rows = await this.prisma.mentionNotification.findMany({
      where: { boardId, userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      actorName: row.actorName,
      taskTitle: row.taskTitle,
      excerpt: row.excerpt,
      createdAt: row.createdAt,
    }));
  }

  /** Dismiss a single notification. Scoped to the recipient so ids can't leak. */
  async remove(boardId: string, userId: string, id: string) {
    await this.prisma.mentionNotification.deleteMany({
      where: { id, boardId, userId },
    });
    return { deleted: true };
  }

  /** Dismiss all of the recipient's notifications on this board. */
  async clear(boardId: string, userId: string) {
    await this.prisma.mentionNotification.deleteMany({
      where: { boardId, userId },
    });
    return { deleted: true };
  }
}
