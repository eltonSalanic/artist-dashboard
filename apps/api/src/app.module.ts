import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { SupabaseAuthGuard } from './auth/supabase-auth.guard';
import { BoardRolesGuard } from './common/board-roles.guard';
import { UsersModule } from './users/users.module';
import { BoardsModule } from './boards/boards.module';
import { InvitesModule } from './invites/invites.module';
import { TasksModule } from './tasks/tasks.module';
import { StatusesModule } from './statuses/statuses.module';
import { ShowStatusesModule } from './show-statuses/show-statuses.module';
import { LayoutsModule } from './layouts/layouts.module';
import { GoalsModule } from './goals/goals.module';
import { EventsModule } from './events/events.module';
import { FocusModule } from './focus/focus.module';
import { RemindersModule } from './reminders/reminders.module';
import { CalendarModule } from './calendar/calendar.module';
import { ArchiveModule } from './archive/archive.module';
import { ActivityModule } from './activity/activity.module';
import { CommentsModule } from './comments/comments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { CustomWidgetModule } from './custom-widget/custom-widget.module';
import { MentionsModule } from './mentions/mentions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NotesModule } from './notes/notes.module';
import { LinksModule } from './links/links.module';
import { FinancesModule } from './finances/finances.module';

@Module({
  imports: [
    // First, so every request runs in its own Sentry scope with breadcrumbs.
    // Reporting itself stays in AllExceptionsFilter (via reportError), which
    // decides what counts as unexpected.
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Drives the notification dispatcher and the wall-clock email jobs.
    ScheduleModule.forRoot(),
    PrismaModule,
    // Global, and imported early so every domain module can log to the feed.
    ActivityModule,
    // Global for the same reason — domain services queue mail inline.
    NotificationsModule,
    AuthModule,
    UsersModule,
    BoardsModule,
    InvitesModule,
    TasksModule,
    StatusesModule,
    ShowStatusesModule,
    LayoutsModule,
    GoalsModule,
    EventsModule,
    FocusModule,
    RemindersModule,
    NotesModule,
    LinksModule,
    CalendarModule,
    ArchiveModule,
    CommentsModule,
    AttachmentsModule,
    CustomWidgetModule,
    MentionsModule,
    FinancesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authentication must populate request.user before the
    // board-role guard reads it.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: BoardRolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}
