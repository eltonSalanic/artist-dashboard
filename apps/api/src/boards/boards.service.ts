import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateBoardDto } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        statuses: { orderBy: { sortOrder: 'asc' } },
        memberships: { include: { user: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!board) throw new NotFoundException('Board not found');
    return {
      id: board.id,
      name: board.name,
      defaultLayout: board.defaultLayout,
      statuses: board.statuses,
      members: board.memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        userId: m.user.id,
        email: m.user.email,
        displayName: m.user.displayName,
        avatarUrl: m.user.avatarUrl,
      })),
    };
  }

  update(boardId: string, dto: UpdateBoardDto) {
    return this.prisma.board.update({
      where: { id: boardId },
      data: { name: dto.name },
      select: { id: true, name: true },
    });
  }
}
