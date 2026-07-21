import { Injectable, NotFoundException } from '@nestjs/common';
import {
  mergeLayouts,
  withShippedWidgets,
  type LayoutItem,
  type UpdateLayoutDto,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LayoutsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { defaultLayout: true },
    });
    if (!board) throw new NotFoundException('Board not found');

    const userLayout = await this.prisma.userLayout.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });

    return {
      layout: mergeLayouts(
        withShippedWidgets(board.defaultLayout as unknown as LayoutItem[]),
        (userLayout?.layout as unknown as LayoutItem[] | undefined) ?? null,
      ),
    };
  }

  async saveForUser(boardId: string, userId: string, dto: UpdateLayoutDto) {
    await this.prisma.userLayout.upsert({
      where: { boardId_userId: { boardId, userId } },
      create: { boardId, userId, layout: dto.layout },
      update: { layout: dto.layout },
    });
    return { layout: dto.layout };
  }

  async saveDefault(boardId: string, dto: UpdateLayoutDto) {
    await this.prisma.board.update({
      where: { id: boardId },
      data: { defaultLayout: dto.layout },
    });
    return { layout: dto.layout };
  }
}
