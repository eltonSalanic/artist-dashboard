import { Injectable, NotFoundException } from '@nestjs/common';
import {
  mergeLayouts,
  mergeMobileLayout,
  mobileLayoutFromWeb,
  withShippedWidgets,
  type LayoutItem,
  type MobileLayoutItem,
  type MobileLayoutResponse,
  type UpdateLayoutDto,
  type UpdateMobileLayoutDto,
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

  /** Drop the user's personal layout so they inherit the board default again. */
  async resetForUser(boardId: string, userId: string) {
    await this.prisma.userLayout.deleteMany({
      where: { boardId, userId },
    });
    return this.getForUser(boardId, userId);
  }

  async saveDefault(boardId: string, dto: UpdateLayoutDto) {
    await this.prisma.board.update({
      where: { id: boardId },
      data: { defaultLayout: dto.layout },
    });
    return { layout: dto.layout };
  }

  /**
   * The phone's arrangement: the one saved on a phone, kept up to date with
   * the board's widgets, or, until there is one, derived from the user's web
   * layout. Both rules are in packages/shared so the phone cannot disagree.
   */
  async getMobileForUser(
    boardId: string,
    userId: string,
  ): Promise<MobileLayoutResponse> {
    const { layout: web } = await this.getForUser(boardId, userId);
    const saved = await this.prisma.mobileLayout.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (!saved) return { items: mobileLayoutFromWeb(web), source: 'web' };
    return {
      items: mergeMobileLayout(
        saved.items as unknown as MobileLayoutItem[],
        web,
      ),
      source: 'phone',
    };
  }

  async saveMobileForUser(
    boardId: string,
    userId: string,
    dto: UpdateMobileLayoutDto,
  ) {
    await this.prisma.mobileLayout.upsert({
      where: { boardId_userId: { boardId, userId } },
      create: { boardId, userId, items: dto.items },
      update: { items: dto.items },
    });
    return this.getMobileForUser(boardId, userId);
  }

  /** Drop the phone's arrangement so it follows the web one again. */
  async resetMobileForUser(boardId: string, userId: string) {
    await this.prisma.mobileLayout.deleteMany({ where: { boardId, userId } });
    return this.getMobileForUser(boardId, userId);
  }
}
