import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DispatcherService } from './dispatcher.service';
import { MAIL_TRANSPORT } from './mail/mail-transport';
import { NoopTransport } from './mail/noop.transport';
import { ResendTransport } from './mail/resend.transport';
import { SmtpTransport } from './mail/smtp.transport';
import { NotificationsService } from './notifications.service';
import { ReminderDueJob } from './reminder-due.job';

/**
 * Global for the same reason ActivityModule is: most domain services queue mail
 * as part of a mutation they already own, and making each one import this would
 * be noise.
 *
 * The transport is chosen once, here. Anywhere but production the mail goes to
 * Mailpit and physically cannot reach a real person — which is what makes the
 * destructive demo seed safe to re-run.
 */
@Global()
@Module({
  providers: [
    NotificationsService,
    DispatcherService,
    ReminderDueJob,
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<string>('NODE_ENV');
        if (env === 'test') return new NoopTransport();
        if (env === 'production') return new ResendTransport(config);
        return new SmtpTransport(config);
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
