import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_BOARD_LAYOUT, DEFAULT_TASK_STATUSES } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      board: membership?.board ?? null,
    };
  }
}
