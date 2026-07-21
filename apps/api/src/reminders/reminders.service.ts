import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateReminderDto, UpdateReminderDto } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  list(boardId: string) {
    return this.prisma.reminder.findMany({
      where: { boardId },
      orderBy: [{ done: 'asc' }, { remindAt: 'asc' }],
    });
  }

  create(boardId: string, dto: CreateReminderDto) {
    return this.prisma.reminder.create({
      data: { boardId, title: dto.title, remindAt: dto.remindAt },
    });
  }

  async update(boardId: string, reminderId: string, dto: UpdateReminderDto) {
    await this.assertInBoard(boardId, reminderId);
    return this.prisma.reminder.update({
      where: { id: reminderId },
      data: dto,
    });
  }

  async remove(boardId: string, reminderId: string) {
    await this.assertInBoard(boardId, reminderId);
    await this.prisma.reminder.delete({ where: { id: reminderId } });
    return { deleted: true };
  }

  private async assertInBoard(boardId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, boardId },
    });
    if (!reminder) throw new NotFoundException('Reminder not found');
  }
}
