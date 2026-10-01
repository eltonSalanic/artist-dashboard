import { Logger } from '@nestjs/common';
import type {
  OutgoingPush,
  PushResult,
  PushTransport,
} from './push-transport';

/**
 * Records instead of sending. Used in tests, and in dev until an Expo project
 * is configured — the mail pipeline has the same arrangement with Mailpit, and
 * a silent no-op beats a dev crash on a missing credential.
 */
export class NoopPushTransport implements PushTransport {
  private readonly logger = new Logger(NoopPushTransport.name);
  readonly sent: OutgoingPush[] = [];

  async send(push: OutgoingPush): Promise<PushResult> {
    this.sent.push(push);
    this.logger.debug(
      `[noop push] ${push.title} -> ${push.tokens.length} device(s)`,
    );
    return { invalidTokens: [] };
  }
}
