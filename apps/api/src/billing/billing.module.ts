import { Global, Module } from '@nestjs/common';
import {
  BillingController,
  MySubscriptionController,
} from './billing.controller';
import { BillingService } from './billing.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';

/**
 * Global: the subscription guard runs on every request, and the board list
 * and cross-board guards ask which boards are paid for.
 */
@Global()
@Module({
  controllers: [
    BillingController,
    MySubscriptionController,
    RevenueCatWebhookController,
  ],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
