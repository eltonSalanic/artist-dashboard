import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { Webhook } from 'standardwebhooks';
import { Public } from '../auth/public.decorator';
import { SuppressionsService, type ResendEvent } from './suppressions.service';

/**
 * Resend signs with Svix's header names; the Standard Webhooks library reads
 * the spec's own. Same signature, two spellings — svix's SDK is a wrapper that
 * renames these three and delegates, and it ships ESM-only.
 */
type IncomingHeaders = Record<string, string | string[] | undefined>;

/** A repeated header is not a signature — anything but a plain string reads as
 * missing, which the library then rejects. */
const header = (headers: IncomingHeaders, ...names: string[]): string => {
  for (const name of names) {
    const value = headers[name];
    if (typeof value === 'string') return value;
  }
  return '';
};

const svixHeaders = (headers: IncomingHeaders) => ({
  'webhook-id': header(headers, 'svix-id', 'webhook-id'),
  'webhook-timestamp': header(headers, 'svix-timestamp', 'webhook-timestamp'),
  'webhook-signature': header(headers, 'svix-signature', 'webhook-signature'),
});

/**
 * Resend can't authenticate as a user, so the Svix signature is the only thing
 * standing between this endpoint and anyone who guesses the URL — without it,
 * a stranger could suppress every address on the board.
 *
 * The signature covers the raw bytes, which is why main.ts creates the app
 * with `rawBody: true`: body-parser's JSON round-trip is not byte-identical,
 * and verifying the re-serialized object fails every time.
 */
@Controller('webhooks/resend')
@Public()
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  constructor(
    private readonly suppressions: SuppressionsService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<express.Request>) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');
    if (!secret) {
      // Refuse rather than accepting unverified events: an endpoint that
      // trusts anything is worse than one that is switched off.
      this.logger.error('RESEND_WEBHOOK_SECRET is not set — rejecting');
      throw new BadRequestException('Webhooks are not configured');
    }
    if (!request.rawBody) throw new BadRequestException('Missing body');

    const body = request.rawBody.toString('utf8');
    let event: ResendEvent;
    try {
      new Webhook(secret).verify(body, svixHeaders(request.headers));
      event = JSON.parse(body) as ResendEvent;
    } catch {
      throw new BadRequestException('Invalid signature');
    }

    const suppressed = await this.suppressions.handle(event);
    // 200 with a body Resend ignores; anything else and it retries.
    return { received: true, suppressed: suppressed.length };
  }
}
