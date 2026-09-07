import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { MailTransport, OutgoingMail } from './mail-transport';

/**
 * Production transport. Resend reports failures in the response body rather
 * than throwing, so anything in `error` is re-thrown here — the dispatcher
 * counts on an exception to mark the delivery failed and schedule a retry.
 */
@Injectable()
export class ResendTransport implements MailTransport {
  private readonly logger = new Logger(ResendTransport.name);
  private readonly client: Resend;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.client = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = config.getOrThrow<string>('MAIL_FROM');
  }

  async send(mail: OutgoingMail): Promise<void> {
    const { error } = await this.client.emails.send(
      {
        from: this.from,
        to: mail.to,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: {
          'List-Unsubscribe': `<${mail.unsubscribePostUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
      { idempotencyKey: mail.idempotencyKey },
    );

    if (error) {
      this.logger.warn(
        `Resend rejected ${mail.idempotencyKey}: ${error.message}`,
      );
      throw new Error(`${error.name}: ${error.message}`);
    }
  }
}
