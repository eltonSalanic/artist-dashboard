import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // Global, and imported early so every domain module can log to the feed.
    ActivityModule,
    AuthModule,
    UsersModule,
    BoardsModule,
    InvitesModule,
    TasksModule,
    StatusesModule,
    LayoutsModule,
    GoalsModule,
    EventsModule,
    FocusModule,
    RemindersModule,
    CalendarModule,
    ArchiveModule,
    CommentsModule,
    AttachmentsModule,
    CustomWidgetModule,
    MentionsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authentication must populate request.user before the
    // board-role guard reads it.
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
    { provide: APP_GUARD, useClass: BoardRolesGuard },
  ],
})
export class AppModule {}
