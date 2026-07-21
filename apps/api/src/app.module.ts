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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BoardsModule,
    InvitesModule,
    TasksModule,
    StatusesModule,
    LayoutsModule,
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
