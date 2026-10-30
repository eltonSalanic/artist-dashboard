import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { BillingService } from './billing.service';
import { SkipSubscription } from './skip-subscription.decorator';

/**
 * Any member may see whether the band is open ('billing.view' in the shared
 * map). Open on a locked band, since this is what tells the apps which screen
 * to show: the paywall for its owner, "ask the owner" for everyone else.
 */
@Controller('boards/:boardId/subscription')
@BoardRoles('USER')
@SkipSubscription()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  get(@Param('boardId') boardId: string, @CurrentUser() user: AuthUser) {
    return this.billing.getForBoard(boardId, user.userId);
  }
}

/** Your own subscription, and whether you can create a band. */
@Controller('me/subscription')
export class MySubscriptionController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.billing.getMine(user.userId);
  }

  /** Right after buying: check with RevenueCat rather than wait for its webhook. */
  @Post('sync')
  sync(@CurrentUser() user: AuthUser) {
    return this.billing.syncFromRevenueCat(user.userId);
  }
}
