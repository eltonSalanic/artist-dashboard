import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  resolveBoardTheme,
  withShippedWidgets,
  type BoardSummaryDto,
  type BoardThemeDto,
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

  /**
   * Every board the caller is a member of, with their role on each.
   *
   * Derived from Membership rather than Board: the membership set *is* the
   * authorisation. There is no board id to guard on here, so unlike every
   * other board route this one cannot use BoardRolesGuard — the `where` clause
   * is what keeps other bands out, and that is the only thing keeping them out.
   *
   * Ordered oldest-first so the list is stable across calls, and so
   * `boards[0]` is the same board `/me` reports as the legacy single `board`.
   */
  async findAllForUser(userId: string): Promise<BoardSummaryDto[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        board: { select: { id: true, name: true } },
      },
    });

    return memberships.map((m) => ({
      id: m.board.id,
      name: m.board.name,
      membershipId: m.id,
      role: m.role,
    }));
  }

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
      theme: resolveBoardTheme(board.theme),
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

  /** Board-wide appearance. Whole-object write: the client always sends a full theme. */
  saveTheme(boardId: string, dto: BoardThemeDto) {
    return this.prisma.board.update({
      where: { id: boardId },
      data: { theme: dto },
      select: { id: true, theme: true },
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
