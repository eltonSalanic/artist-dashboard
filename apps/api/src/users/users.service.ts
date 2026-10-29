import { Injectable, NotFoundException } from '@nestjs/common';
import { resolveBoardTheme } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { toBoardSummary } from '../boards/board-summary';
import type { AuthUser } from '../auth/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Idempotent first-call setup for a signed-in user:
   * 1. Adopt an orphaned User row with the same email (see below), then
   *    upsert the local User row.
   * 2. Activate any pending invites matching the email.
   *
   * It never creates a band: someone who signs up with no invite lands on
   * "Join or create one" and starts a band themselves (POST /boards).
   */
  async bootstrap(auth: AuthUser) {
    const displayName = auth.email.split('@')[0];

    await this.prisma.$transaction(async (tx) => {
      // Accounts made under Supabase Auth left User rows whose id matches no
      // sign-in account. Signing up again with that email takes the row over
      // (every foreign key to User cascades on update), so the bands and
      // history come along. A row that still belongs to a live account is
      // never touched: the upsert below then fails on the unique email.
      const sameEmail = await tx.user.findUnique({
        where: { email: auth.email },
        select: { id: true },
      });
      if (sameEmail && sameEmail.id !== auth.userId) {
        const owner = await tx.authUser.findUnique({
          where: { id: sameEmail.id },
          select: { id: true },
        });
        if (!owner) {
          await tx.user.update({
            where: { id: sameEmail.id },
            data: { id: auth.userId },
          });
        }
      }

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
      /**
       * Every board the caller belongs to, with their role on each. Ordered
       * oldest-first, so `boards[0]` is always the board the two legacy fields
       * below describe.
       */
      boards: user.memberships.map(toBoardSummary),
      /**
       * `membership` and `board` are the pre-multi-board shape, kept populated
       * with the first membership.
       *
       * They are not deprecated-but-dead: fifteen files in apps/web read them,
       * six of them reading `board` directly, and app-shell.tsx gates the whole
       * authenticated app on `board` being non-null. Removing them here would
       * turn an additive API change into a web migration, which is a separate
       * decision taken at a separate time.
       *
       * The consequence is deliberate and known: web still shows only the first
       * board. Closing that is its own phase — see docs/mobile-app.md (P15).
       */
      membership: membership
        ? { id: membership.id, role: membership.role }
        : null,
      // The theme rides along on /me so the dashboard paints the board's colors
      // on first render, without a second round-trip to GET /boards/:id.
      board: board ? { ...board, theme: resolveBoardTheme(board.theme) } : null,
    };
  }
}
