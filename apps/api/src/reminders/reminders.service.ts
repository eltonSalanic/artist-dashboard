import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateReminderDto, UpdateReminderDto } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  list(boardId: string) {
    return this.prisma.reminder.findMany({
      where: { boardId },
      // Dated reminders come first, soonest first; undated notes trail them.
      orderBy: [
        { done: 'asc' },
        { remindAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });
  }

  async findOne(boardId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, boardId },
    });
    if (!reminder) throw new NotFoundException('Reminder not found');
    return reminder;
  }

  create(boardId: string, dto: CreateReminderDto) {
    return this.prisma.reminder.create({
      data: {
        boardId,
        title: dto.title,
        description: dto.description ?? null,
        remindAt: dto.remindAt ?? null,
      },
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
