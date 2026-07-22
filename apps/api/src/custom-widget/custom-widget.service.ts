import { Injectable } from '@nestjs/common';
import type { UpdateCustomWidgetDto } from '@artist/shared';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Shape TipTap treats as an empty document. */
const EMPTY_DOC = { type: 'doc', content: [] };

@Injectable()
export class CustomWidgetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns a default rather than 404ing: the widget exists on the dashboard
   * from the moment it's shown, whether or not anyone has typed in it.
   */
  async get(boardId: string) {
    const row = await this.prisma.customWidgetContent.findUnique({
      where: { boardId },
    });
    return {
      title: row?.title ?? 'Notes',
      content: (row?.content as object) ?? EMPTY_DOC,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  async set(boardId: string, dto: UpdateCustomWidgetDto) {
    const content = dto.content as Prisma.InputJsonValue;
    const row = await this.prisma.customWidgetContent.upsert({
      where: { boardId },
      create: { boardId, content, ...(dto.title ? { title: dto.title } : {}) },
      update: { content, ...(dto.title ? { title: dto.title } : {}) },
    });
    return {
      title: row.title,
      content: row.content as object,
      updatedAt: row.updatedAt,
    };
  }
}
