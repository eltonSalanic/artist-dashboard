import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateShowStatusDto,
  ShowStatusCategory,
  UpdateShowStatusDto,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

const NO_START_STATUS =
  'A board needs at least one show status that is not a cancellation';

/**
 * The band's show statuses. Shaped like task statuses, with a category in
 * place of `isDone`, and one extra rule: a board always keeps a status a new
 * show can start in, so it never runs out of non-cancelled ones.
 */
@Injectable()
export class ShowStatusesService {
  constructor(private readonly prisma: PrismaService) {}

  list(boardId: string) {
    return this.prisma.showStatus.findMany({
      where: { boardId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(boardId: string, dto: CreateShowStatusDto) {
    const last = await this.prisma.showStatus.aggregate({
      where: { boardId },
      _max: { sortOrder: true },
    });
    return this.prisma.showStatus.create({
      data: { boardId, ...dto, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
  }

  async update(boardId: string, statusId: string, dto: UpdateShowStatusDto) {
    const status = await this.getOwned(boardId, statusId);
    if (
      dto.category === 'CANCELLED' &&
      status.category !== 'CANCELLED' &&
      (await this.othersStartable(boardId, statusId)) === 0
    ) {
      throw new ConflictException(NO_START_STATUS);
    }
    return this.prisma.showStatus.update({
      where: { id: statusId },
      data: dto,
    });
  }

  async remove(boardId: string, statusId: string) {
    const status = await this.getOwned(boardId, statusId);
    const inUse = await this.prisma.event.count({
      where: { showStatusId: statusId },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `${inUse} show(s) still use this status. Move them first`,
      );
    }
    if (
      status.category !== 'CANCELLED' &&
      (await this.othersStartable(boardId, statusId)) === 0
    ) {
      throw new ConflictException(NO_START_STATUS);
    }
    await this.prisma.showStatus.delete({ where: { id: statusId } });
    return { deleted: true };
  }

  private othersStartable(boardId: string, exceptId: string) {
    return this.prisma.showStatus.count({
      where: {
        boardId,
        id: { not: exceptId },
        category: { not: 'CANCELLED' satisfies ShowStatusCategory },
      },
    });
  }

  private async getOwned(boardId: string, statusId: string) {
    const status = await this.prisma.showStatus.findFirst({
      where: { id: statusId, boardId },
    });
    if (!status) throw new NotFoundException('Show status not found');
    return status;
  }
}
