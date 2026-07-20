import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateStatusDto, UpdateStatusDto } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatusesService {
  constructor(private readonly prisma: PrismaService) {}

  list(boardId: string) {
    return this.prisma.taskStatus.findMany({
      where: { boardId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(boardId: string, dto: CreateStatusDto) {
    const last = await this.prisma.taskStatus.aggregate({
      where: { boardId },
      _max: { sortOrder: true },
    });
    return this.prisma.taskStatus.create({
      data: { boardId, ...dto, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
  }

  async update(boardId: string, statusId: string, dto: UpdateStatusDto) {
    await this.getOwned(boardId, statusId);
    return this.prisma.taskStatus.update({
      where: { id: statusId },
      data: dto,
    });
  }

  async remove(boardId: string, statusId: string) {
    await this.getOwned(boardId, statusId);
    const inUse = await this.prisma.task.count({ where: { statusId } });
    if (inUse > 0) {
      throw new ConflictException(
        `${inUse} task(s) still use this status — move them first`,
      );
    }
    const remaining = await this.prisma.taskStatus.count({
      where: { boardId },
    });
    if (remaining <= 1) {
      throw new ConflictException('A board needs at least one status');
    }
    await this.prisma.taskStatus.delete({ where: { id: statusId } });
    return { deleted: true };
  }

  private async getOwned(boardId: string, statusId: string) {
    const status = await this.prisma.taskStatus.findFirst({
      where: { id: statusId, boardId },
    });
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }
}
