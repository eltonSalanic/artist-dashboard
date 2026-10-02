import { Module } from '@nestjs/common';
import {
  CalendarController,
  CrossBoardCalendarController,
} from './calendar.controller';
import { CalendarService } from './calendar.service';
import { UserBoardsGuard } from '../common/user-boards.guard';

@Module({
  controllers: [CalendarController, CrossBoardCalendarController],
  // UserBoardsGuard resolves PrismaService from the global PrismaModule even
  // when referenced only by @UseGuards, but registering it here keeps that
  // true through refactors rather than by luck.
  providers: [CalendarService, UserBoardsGuard],
})
export class CalendarModule {}
