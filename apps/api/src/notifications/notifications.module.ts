import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DispatcherService } from './dispatcher.service';
import {
  NotificationPreferencesController,
  UnsubscribeController,
} from './notifications.controller';
import { ResendWebhookController } from './resend-webhook.controller';
import { SuppressionsService } from './suppressions.service';
import { MAIL_TRANSPORT } from './mail/mail-transport';
import { NoopTransport } from './mail/noop.transport';
import { ResendTransport } from './mail/resend.transport';
import { SmtpTransport } from './mail/smtp.transport';
import { NotificationsService } from './notifications.service';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { PUSH_TRANSPORT } from './push/push-transport';
import { ExpoPushTransport } from './push/expo.push-transport';
import { NoopPushTransport } from './push/noop.push-transport';
import { UnsubscribeService } from './unsubscribe.service';
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
  controllers: [
    UnsubscribeController,
    NotificationPreferencesController,
    ResendWebhookController,
    DevicesController,
  ],
  providers: [
    NotificationsService,
    DevicesService,
    UnsubscribeService,
    SuppressionsService,
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
    {
      provide: PUSH_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Noop outside production for the same reason mail goes to Mailpit: a
        // dev run must not be able to buzz a real phone, and the demo seed has
        // to stay safe to re-run.
        //
        // In production the real transport is always used. EXPO_ACCESS_TOKEN is
        // genuinely optional — Expo only requires it once a project turns on
        // push security — so there is no credential to gate on, and gating on
        // one would silently disable push for projects that need no token.
        if (config.get<string>('NODE_ENV') !== 'production') {
          return new NoopPushTransport();
        }
        return new ExpoPushTransport(config.get<string>('EXPO_ACCESS_TOKEN'));
      },
    },
  ],
  exports: [NotificationsService, DevicesService],
})
export class NotificationsModule {}
