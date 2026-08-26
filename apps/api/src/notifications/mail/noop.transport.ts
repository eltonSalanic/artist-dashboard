import { Injectable, Logger } from '@nestjs/common';
import type { MailTransport, OutgoingMail } from './mail-transport';

/**
 * Test transport. Records what it was asked to send and delivers nothing, so a
 * suite can assert on recipients and subjects without a socket or an API key.
 */
@Injectable()
export class NoopTransport implements MailTransport {
  private readonly logger = new Logger(NoopTransport.name);
  readonly sent: OutgoingMail[] = [];

  send(mail: OutgoingMail): Promise<void> {
    this.sent.push(mail);
    this.logger.debug(`Swallowed mail to ${mail.to}: ${mail.subject}`);
    return Promise.resolve();
  }
}
