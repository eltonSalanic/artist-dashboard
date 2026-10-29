import { Controller, Get, Param } from '@nestjs/common';
import { BoardRoles } from '../common/board-roles.decorator';
import { BillingService } from './billing.service';
import { SkipSubscription } from './skip-subscription.decorator';

/**
 * Any member may see whether the band is subscribed ('billing.view' in the
 * shared map). Open on an unpaid board, since this is what tells the apps to
 * show the paywall.
 */
@Controller('boards/:boardId/subscription')
@BoardRoles('USER')
@SkipSubscription()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  get(@Param('boardId') boardId: string) {
    return this.billing.getForBoard(boardId);
  }
}
