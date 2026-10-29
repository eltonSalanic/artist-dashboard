import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import type { AuthedRequest } from './authed-request';

/**
 * Resolves every board the caller belongs to and attaches the ids to the
 * request, for the handful of routes that aggregate *across* boards and so
 * have no `:boardId` for `BoardRolesGuard` to check.
 *
 * On those routes this list is the entire authorisation. It is resolved here,
 * once, from `Membership` — never from anything the client sends — so no
 * handler can widen it and no handler has to remember to narrow it.
 *
 * With billing enforced, boards without a subscription drop out of the list, the
 * same as their own routes answering 402.
 */
@Injectable()
export class UserBoardsGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    // The global auth guard runs first and should have populated this; if it
    // somehow did not, there is no caller to scope to and nothing safe to do.
    if (!request.user) throw new UnauthorizedException();

    const memberships = await this.prisma.membership.findMany({
      where: { userId: request.user.userId },
      select: { boardId: true },
    });
    request.userBoardIds = await this.billing.accessibleBoards(
      memberships.map((m) => m.boardId),
    );
    return true;
  }
}
