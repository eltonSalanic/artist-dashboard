import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../auth/public.decorator';
import { BillingService } from './billing.service';
import { revenueCatWebhookSchema } from './revenuecat-event';

/**
 * RevenueCat can't sign in, and doesn't sign its webhooks either: it sends
 * back whatever Authorization header value is set on the webhook in its
 * dashboard. That shared value (REVENUECAT_WEBHOOK_AUTH) is the only thing
 * stopping a stranger from granting a band Band Pro, so it is compared in
 * constant time and an unset value refuses everything.
 */
@Controller('billing/revenuecat/webhook')
@Public()
export class RevenueCatWebhookController {
  private readonly logger = new Logger(RevenueCatWebhookController.name);

  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const expected = this.config.get<string>('REVENUECAT_WEBHOOK_AUTH');
    if (!expected) {
      this.logger.error('REVENUECAT_WEBHOOK_AUTH is not set — rejecting');
      throw new BadRequestException('Webhooks are not configured');
    }
    if (!matches(authorization, expected)) {
      this.logger.warn('Rejected RevenueCat webhook: wrong Authorization');
      throw new UnauthorizedException();
    }

    const parsed = revenueCatWebhookSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Malformed event');

    const { event } = parsed.data;
    const outcome = await this.billing.handleEvent(event);
    this.logger.log(`RevenueCat ${event.type} ${event.id}: ${outcome}`);
    // Anything but a 200 and RevenueCat retries, so an event we chose to
    // ignore still gets one.
    return { received: true, outcome };
  }
}

function matches(given: string | undefined, expected: string): boolean {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
