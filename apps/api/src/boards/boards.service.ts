import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  withShippedWidgets,
  type LayoutItem,
  type UpdateBoardDto,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

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
      defaultLayout: withShippedWidgets(
        board.defaultLayout as unknown as LayoutItem[],
      ),
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

  /**
   * Removes a member from the board: revokes their membership and cleans up
   * their board-scoped data (personal layout, task assignments). The user
   * account itself is global and stays. Admins can't remove themselves — that
   * avoids orphaning the board and locking out its last admin.
   */
  async removeMember(boardId: string, actorId: string, userId: string) {
    if (userId === actorId) {
      throw new BadRequestException(
        'You cannot remove yourself from the board',
      );
    }

    const membership = await this.prisma.membership.findFirst({
      where: { boardId, userId },
      include: { user: { select: { displayName: true } } },
    });
    if (!membership) throw new NotFoundException('Member not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.delete({ where: { id: membership.id } });
      await tx.userLayout.deleteMany({ where: { boardId, userId } });
      await tx.taskAssignee.deleteMany({
        where: { userId, task: { boardId } },
      });
      await this.activity.log(tx, {
        boardId,
        type: 'MEMBER_REMOVED',
        actorId,
        meta: {
          memberId: userId,
          memberName: membership.user.displayName,
          removedFromBoard: true,
        },
      });
    });

    return { removed: true };
  }
}
