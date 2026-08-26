import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailTransport, OutgoingMail } from './mail-transport';

/**
 * Development transport, pointed at the local stack's Mailpit. Mailpit accepts
 * mail for any address and forwards none of it, which is what makes it safe to
 * run the destructive demo seed against: nothing can reach a real inbox.
 *
 * Requires `smtp_port = 54325` under `[inbucket]` in supabase/config.toml —
 * GoTrue reaches Mailpit over Docker's internal network, but our API runs on
 * the host and needs the port published.
 */
@Injectable()
export class SmtpTransport implements MailTransport {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.transporter = createTransport({
      host: config.get<string>('SMTP_HOST') ?? '127.0.0.1',
      port: Number(config.get<string>('SMTP_PORT') ?? 54325),
      // Mailpit speaks plaintext and wants no credentials.
      secure: false,
      ignoreTLS: true,
    });
    this.from =
      config.get<string>('MAIL_FROM') ?? 'Artist Dashboard <dev@localhost>';
  }

  async send(mail: OutgoingMail): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: {
        'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
      },
    });
  }
}
