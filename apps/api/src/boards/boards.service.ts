import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  resolveBoardTheme,
  withShippedWidgets,
  type ApiErrorBody,
  type BoardSummaryDto,
  type BoardThemeDto,
  type CreateBoardDto,
  type LayoutItem,
  type OwnershipBlock,
  type UpdateBoardDto,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SUMMARY_OWNER_SELECT, toBoardSummary } from './board-summary';
import { BillingService } from '../billing/billing.service';
import { StorageService } from '../attachments/storage.service';
import { newBoardData } from './new-board';
import { ActivityService } from '../activity/activity.service';

/** A person can't own a band: 402 to subscribe, or 409 for the one-band limit. */
function ownershipError(block: OwnershipBlock): HttpException {
  if (block === 'NO_SUBSCRIPTION') {
    const body: ApiErrorBody = {
      statusCode: HttpStatus.PAYMENT_REQUIRED,
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'You need a Band Wall subscription to own a band.',
    };
    return new HttpException(body, HttpStatus.PAYMENT_REQUIRED);
  }
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    code: 'BAND_LIMIT_REACHED',
    message: 'A subscription covers one band, and that one’s already taken.',
  } satisfies ApiErrorBody);
}

@Injectable()
export class BoardsService {
  private readonly logger = new Logger(BoardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly billing: BillingService,
    private readonly storage: StorageService,
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
        // `theme` is a column on the row this join already reads, so the
        // palette costs nothing extra; the rest of the theme stays behind
        // `GET /boards/:id`.
        board: {
          select: {
            id: true,
            name: true,
            theme: true,
            ownerId: true,
            owner: SUMMARY_OWNER_SELECT,
          },
        },
      },
    });

    const enforced = this.billing.enforced;
    return memberships.map((m) => toBoardSummary(m, userId, enforced));
  }

  /**
   * A new band with the caller as its owner and only admin. With billing
   * enforced that takes a subscription and no band already owned.
   */
  async create(userId: string, dto: CreateBoardDto): Promise<BoardSummaryDto> {
    const block = await this.billing.ownershipBlock(userId);
    if (block) throw ownershipError(block);

    const board = await this.prisma.board.create({
      data: newBoardData(dto.name, userId),
      select: {
        id: true,
        name: true,
        theme: true,
        memberships: { select: { id: true, role: true } },
      },
    });
    const [membership] = board.memberships;
    return toBoardSummary(
      {
        id: membership.id,
        role: membership.role,
        board: {
          id: board.id,
          name: board.name,
          theme: board.theme,
          ownerId: userId,
          owner: { subscription: await this.billing.subscriptionOf(userId) },
        },
      },
      userId,
      this.billing.enforced,
    );
  }

  async findOne(boardId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        statuses: { orderBy: { sortOrder: 'asc' } },
        showStatuses: { orderBy: { sortOrder: 'asc' } },
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
      currency: board.currency,
      ownerId: board.ownerId,
      statuses: board.statuses,
      showStatuses: board.showStatuses,
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
   * Deletes the band for everyone, for good. Owner only, and the owner types
   * the band's name so it can't be done by a stray tap.
   *
   * Foreign keys cascade from the board, except that an event blocks deleting
   * its show status, so events go first. Stored files aren't rows: they're
   * removed after the commit, and a failure there leaves orphaned files rather
   * than a half-deleted band.
   */
  async remove(boardId: string, userId: string, confirmName: string) {
    const board = await this.requireOwned(boardId, userId);
    if (confirmName.trim() !== board.name.trim()) {
      throw new BadRequestException('That doesn’t match the band’s name.');
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { boardId },
      select: { storagePath: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.event.deleteMany({ where: { boardId } });
      await tx.board.delete({ where: { id: boardId } });
    });

    if (attachments.length > 0) {
      try {
        await this.storage.remove(attachments.map((a) => a.storagePath));
      } catch (error) {
        this.logger.warn(
          `Band ${boardId} deleted, but its files were not: ${String(error)}`,
        );
      }
    }
    return { deleted: true };
  }

  /**
   * Hands the band to another member, who has to be able to own a band. Their
   * subscription keeps it open from here on. The new owner becomes an admin,
   * and the old owner stays on as one.
   */
  async transfer(boardId: string, userId: string, newOwnerId: string) {
    await this.requireOwned(boardId, userId);
    if (newOwnerId === userId) {
      throw new BadRequestException('You already own this band.');
    }
    const membership = await this.prisma.membership.findUnique({
      where: { boardId_userId: { boardId, userId: newOwnerId } },
    });
    if (!membership) throw new NotFoundException('Member not found');

    const block = await this.billing.ownershipBlock(newOwnerId);
    if (block === 'NO_SUBSCRIPTION') {
      throw new BadRequestException(
        'They need their own Band Wall subscription to take over.',
      );
    }
    if (block === 'ALREADY_OWNS_BAND') {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'BAND_LIMIT_REACHED',
        message: 'They already own a band.',
      } satisfies ApiErrorBody);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.board.update({
        where: { id: boardId },
        data: { ownerId: newOwnerId },
      });
      await tx.membership.update({
        where: { id: membership.id },
        data: { role: 'ADMIN' },
      });
    });
    return { ownerId: newOwnerId };
  }

  private async requireOwned(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { name: true, ownerId: true },
    });
    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId !== userId) {
      throw new ForbiddenException('Only the band’s owner can do that.');
    }
    return board;
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
      // An ex-member's mention rows carry a snapshotted task title and comment
      // excerpt — this board's content, sitting in their inbox. Until the
      // cross-board GET /mentions existed, BoardRolesGuard happened to hide
      // them by 404-ing on the missing membership; that was a mask, not a fix,
      // and leaving them would have made this board's text readable to someone
      // removed from it.
      await tx.mentionNotification.deleteMany({ where: { boardId, userId } });
      // Their choices about this board's mail, which they can no longer
      // receive. Harmless if left, but they would silently resurrect if the
      // person were ever re-invited.
      await tx.notificationPreference.deleteMany({
        where: { boardId, userId },
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
