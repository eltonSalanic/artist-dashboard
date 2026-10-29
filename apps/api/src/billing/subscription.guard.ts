import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiErrorBody } from '@artist/shared';
import { BOARD_ROLE_KEY } from '../common/board-roles.decorator';
import type { AuthedRequest } from '../common/authed-request';
import { BillingService } from './billing.service';
import { SKIP_SUBSCRIPTION_KEY } from './skip-subscription.decorator';

export const SUBSCRIPTION_REQUIRED_MESSAGE =
  'This band needs Band Pro. An admin can subscribe from the band’s settings.';

/**
 * Closes every board route until the board has Band Pro, when
 * BILLING_ENFORCED=true. A board route is one marked `@BoardRoles`, which is
 * also what makes `BoardRolesGuard` check membership; it runs first, so by
 * the time this answers 402 the caller is known to be on the board, and a
 * stranger still gets the 404.
 *
 * Routes without a board (sign-in, `/me`, the board list, creating a band,
 * the webhooks) never reach the check. The cross-board calendar and mentions
 * are narrowed to paid boards in `UserBoardsGuard` instead.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly billing: BillingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.billing.enforced) return true;
    const targets = [context.getHandler(), context.getClass()];
    if (!this.reflector.getAllAndOverride(BOARD_ROLE_KEY, targets)) return true;
    if (
      this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_KEY, targets)
    )
      return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const rawBoardId = request.params.boardId ?? request.params.id;
    // BoardRolesGuard has already turned anything but a plain id into a 404.
    if (typeof rawBoardId !== 'string') return true;

    if (await this.billing.requiresSubscription(rawBoardId)) {
      const body: ApiErrorBody = {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        code: 'BOARD_SUBSCRIPTION_REQUIRED',
        message: SUBSCRIPTION_REQUIRED_MESSAGE,
      };
      throw new HttpException(body, HttpStatus.PAYMENT_REQUIRED);
    }
    return true;
  }
}
