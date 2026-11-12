import {
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  attachmentObjectPaths,
  StorageService,
} from '../storage/storage.service';
import type { AuthUser } from '../auth/current-user.decorator';

/**
 * Stands in for a deleted account on everything it made in a band that
 * carries on: tasks, comments, files, links and invites. It has no sign-in
 * account and no membership, so nobody can sign in as it and it never shows in
 * a band's member list; it only gives those rows an author to point at.
 */
export const FORMER_MEMBER = {
  id: '00000000-0000-4000-8000-000000000000',
  email: 'former-member@bandwall.invalid',
  displayName: 'Former member',
} as const;

/**
 * Deletes a person's account for good (App Store guideline 5.1.1(v)).
 *
 * - A band they own that has anyone else in it stops the deletion (409
 *   `OWNS_SHARED_BANDS`, listing those bands): they hand it over or delete it
 *   first, because deleting it for them would take it from the rest of the band.
 * - Bands where they're the only member are deleted with the account.
 * - In bands that carry on, what they made moves to {@link FORMER_MEMBER}.
 *   Everything that's only theirs (memberships, layouts, notifications, push
 *   devices, mentions, subscription record) goes with the User row by cascade;
 *   finance entries and activity lines keep their row with no name on it.
 * - Then the sign-in account goes, and its sessions and linked Apple / Google
 *   accounts with it.
 *
 * Stored files aren't rows: those of the deleted bands are removed after the
 * commit, and a failure there leaves orphaned files rather than a half-deleted
 * account, as when a band is deleted.
 *
 * TODO(sign-in-with-apple): Apple expects the app to revoke the person's Apple
 * tokens when they delete their account (POST https://appleid.apple.com/auth/revoke).
 * That needs a client secret signed with the Sign in with Apple .p8 key, which
 * we don't hold yet, and the refresh token from the sign-in, which the native
 * flow doesn't hand the API today. See docs/account-deletion.md.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async deleteAccount(auth: AuthUser): Promise<void> {
    const userId = auth.userId;
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: {
        board: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            _count: { select: { memberships: true } },
          },
        },
      },
    });
    const boards = memberships.map((m) => m.board);
    // A band they own outright also counts when they've somehow left its
    // member list: it would otherwise be left with an owner who doesn't exist.
    const ownedElsewhere = await this.prisma.board.findMany({
      where: { ownerId: userId, memberships: { none: { userId } } },
      select: {
        id: true,
        name: true,
        ownerId: true,
        _count: { select: { memberships: true } },
      },
    });

    const others = (b: (typeof boards)[number]) =>
      b._count.memberships - (boards.includes(b) ? 1 : 0);
    const shared = [...boards, ...ownedElsewhere].filter(
      (b) => b.ownerId === userId && others(b) > 0,
    );
    if (shared.length > 0) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        code: 'OWNS_SHARED_BANDS',
        message:
          'Hand over or delete the bands you share with others before deleting your account.',
        boards: shared.map((b) => ({ id: b.id, name: b.name })),
      } satisfies ApiErrorBody);
    }

    // Bands nobody else is in, unless someone else owns them: those keep
    // their owner and only lose this member.
    const doomed = [...boards, ...ownedElsewhere]
      .filter(
        (b) => others(b) === 0 && (b.ownerId === userId || b.ownerId === null),
      )
      .map((b) => b.id);
    const kept =
      boards.length -
      doomed.filter((id) => boards.some((b) => b.id === id)).length;

    const files = doomed.length
      ? await this.prisma.attachment.findMany({
          where: { boardId: { in: doomed } },
          select: { storagePath: true, thumbnailPath: true },
        })
      : [];

    await this.prisma.$transaction(async (tx) => {
      if (doomed.length > 0) {
        // An event blocks deleting its show status, so events go first; the
        // rest cascades from the board.
        await tx.event.deleteMany({ where: { boardId: { in: doomed } } });
        await tx.board.deleteMany({ where: { id: { in: doomed } } });
      }

      // What they made anywhere else stays with the band, under the
      // placeholder. Rows in the deleted bands are already gone.
      await tx.user.upsert({
        where: { id: FORMER_MEMBER.id },
        update: {},
        create: { ...FORMER_MEMBER },
      });
      const to = { id: FORMER_MEMBER.id };
      await tx.task.updateMany({
        where: { createdById: userId },
        data: { createdById: to.id },
      });
      await tx.comment.updateMany({
        where: { authorId: userId },
        data: { authorId: to.id },
      });
      await tx.attachment.updateMany({
        where: { uploadedById: userId },
        data: { uploadedById: to.id },
      });
      await tx.itemLink.updateMany({
        where: { createdById: userId },
        data: { createdById: to.id },
      });
      await tx.invite.updateMany({
        where: { invitedById: userId },
        data: { invitedById: to.id },
      });
      // Invites waiting for this address would pull a new account with the
      // same email straight back into those bands.
      await tx.invite.deleteMany({
        where: { email: auth.email, status: 'PENDING' },
      });

      await tx.user.deleteMany({ where: { id: userId } });
      // Sessions and linked accounts cascade from the sign-in account.
      await tx.authUser.deleteMany({ where: { id: userId } });
    });

    this.logger.log(
      `Account ${userId} deleted (${doomed.length} solo band(s) removed, ${kept} left)`,
    );

    if (files.length > 0) {
      try {
        await this.storage.remove(attachmentObjectPaths(files));
      } catch (error) {
        this.logger.warn(
          `Account ${userId} deleted, but its bands' files were not: ${String(error)}`,
        );
      }
    }
  }
}
