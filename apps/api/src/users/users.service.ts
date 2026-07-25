import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_BOARD_LAYOUT,
  DEFAULT_TASK_STATUSES,
  resolveBoardTheme,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import type { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Idempotent first-call setup for an authenticated Supabase user:
   * 1. Upsert the local User row.
   * 2. Activate any pending invites matching the verified email.
   * 3. If the user still has no board, create one and make them its admin.
   */
  async bootstrap(auth: AuthUser) {
    const displayName = auth.email.split('@')[0];

    await this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: auth.userId },
        update: { email: auth.email },
        create: { id: auth.userId, email: auth.email, displayName },
      });

      const pendingInvites = await tx.invite.findMany({
        where: { email: auth.email, status: 'PENDING' },
      });
      for (const invite of pendingInvites) {
        const existingMembership = await tx.membership.findUnique({
          where: {
            boardId_userId: { boardId: invite.boardId, userId: auth.userId },
          },
        });
        await tx.membership.upsert({
          where: {
            boardId_userId: { boardId: invite.boardId, userId: auth.userId },
          },
          update: {},
          create: {
            boardId: invite.boardId,
            userId: auth.userId,
            role: invite.role,
          },
        });
        await tx.invite.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED' },
        });
        // The board gains a member the first time an invite converts; the
        // actor is the person joining.
        if (!existingMembership) {
          await this.activity.log(tx, {
            boardId: invite.boardId,
            type: 'MEMBER_ASSIGNED',
            actorId: auth.userId,
            meta: {
              memberId: auth.userId,
              memberName: displayName,
              role: invite.role,
              joinedBoard: true,
            },
          });
        }
      }

      const membership = await tx.membership.findFirst({
        where: { userId: auth.userId },
      });
      if (!membership) {
        await tx.board.create({
          data: {
            name: `${displayName}'s band`,
            defaultLayout: DEFAULT_BOARD_LAYOUT as object[],
            memberships: {
              create: { userId: auth.userId, role: 'ADMIN' },
            },
            statuses: { create: DEFAULT_TASK_STATUSES },
          },
        });
      }
    });

    return this.me(auth);
  }

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        memberships: {
          orderBy: { createdAt: 'asc' },
          include: { board: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not bootstrapped');

    const membership = user.memberships[0] ?? null;
    const board = membership?.board ?? null;
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      membership: membership
        ? { id: membership.id, role: membership.role }
        : null,
      // The theme rides along on /me so the dashboard paints the board's colors
      // on first render, without a second round-trip to GET /boards/:id.
      board: board ? { ...board, theme: resolveBoardTheme(board.theme) } : null,
    };
  }
}
