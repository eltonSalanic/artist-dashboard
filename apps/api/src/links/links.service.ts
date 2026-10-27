import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  can,
  type BoardRole,
  type CreateItemLinkDto,
  type LinkParentDto,
  type LinkParentKind,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

const PARENT_COLUMN = {
  TASK: 'taskId',
  EVENT: 'eventId',
  GOAL: 'goalId',
  REMINDER: 'reminderId',
} as const satisfies Record<LinkParentKind, string>;

const LINK_SELECT = {
  id: true,
  title: true,
  url: true,
  createdById: true,
  createdAt: true,
} as const;

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(boardId: string, parent: LinkParentDto) {
    await this.assertParent(boardId, parent);
    return this.prisma.itemLink.findMany({
      where: { boardId, [PARENT_COLUMN[parent.kind]]: parent.parentId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: LINK_SELECT,
    });
  }

  async create(
    boardId: string,
    userId: string,
    role: BoardRole,
    dto: CreateItemLinkDto,
  ) {
    if (!can(role, 'link.add'))
      throw new ForbiddenException("You can't add links");
    await this.assertParent(boardId, dto);
    return this.prisma.itemLink.create({
      data: {
        boardId,
        [PARENT_COLUMN[dto.kind]]: dto.parentId,
        title: dto.title || new URL(dto.url).hostname,
        url: dto.url,
        createdById: userId,
      },
      select: LINK_SELECT,
    });
  }

  async remove(
    boardId: string,
    linkId: string,
    userId: string,
    role: BoardRole,
  ) {
    const link = await this.prisma.itemLink.findFirst({
      where: { id: linkId, boardId },
    });
    if (!link) throw new NotFoundException('Link not found');
    if (link.createdById !== userId && !can(role, 'link.manage')) {
      throw new ForbiddenException('You can only remove your own links');
    }
    await this.prisma.itemLink.delete({ where: { id: linkId } });
    return { deleted: true };
  }

  private async assertParent(
    boardId: string,
    { kind, parentId }: LinkParentDto,
  ) {
    const args = {
      where: { id: parentId, boardId },
      select: { id: true },
    } as const;
    const parent =
      kind === 'TASK'
        ? await this.prisma.task.findFirst(args)
        : kind === 'EVENT'
          ? await this.prisma.event.findFirst(args)
          : kind === 'GOAL'
            ? await this.prisma.goal.findFirst(args)
            : await this.prisma.reminder.findFirst(args);
    if (!parent) throw new NotFoundException('Item not found');
  }
}
