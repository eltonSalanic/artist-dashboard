import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NotificationCategory,
  UnsubscribeResultDto,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { verifyUnsubscribeToken } from './unsubscribe-token';

/**
 * Separate from NotificationsService on purpose: that one is injected into
 * every domain service that queues mail inside a transaction, and it has no
 * business knowing about signing secrets. This is the only code path that
 * turns a token back into a person.
 */
@Injectable()
export class UnsubscribeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Behind the link in every email footer, and behind the one-click
   * List-Unsubscribe header. There is no session to read: the signed token is
   * the entire proof, and all it can do is turn one category off for one
   * person on one board.
   *
   * Unsubscribing twice is not an error — the second click lands on the same
   * state as the first, which is what someone re-reading an old email expects.
   */
  async unsubscribe(token: string): Promise<UnsubscribeResultDto> {
    const claims = verifyUnsubscribeToken(
      token,
      this.config.getOrThrow<string>('UNSUBSCRIBE_SECRET'),
    );
    if (!claims) throw new BadRequestException('That link is not valid');

    // A deleted board or user would fail the upsert's foreign key; checking
    // first turns a 500 into a sentence someone can read.
    const [board, user] = await Promise.all([
      this.prisma.board.findUnique({
        where: { id: claims.boardId },
        select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: claims.userId },
        select: { id: true },
      }),
    ]);
    if (!board || !user)
      throw new BadRequestException('That link is not valid');

    const category = claims.category as NotificationCategory;
    await this.notifications.setPreference(
      claims.boardId,
      claims.userId,
      category,
      false,
    );
    return { category, boardName: board.name };
  }
}
