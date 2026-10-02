import { Module } from '@nestjs/common';
import {
  CrossBoardMentionsController,
  MentionsController,
} from './mentions.controller';
import { MentionsService } from './mentions.service';
import { UserBoardsGuard } from '../common/user-boards.guard';

@Module({
  controllers: [MentionsController, CrossBoardMentionsController],
  providers: [MentionsService, UserBoardsGuard],
  exports: [MentionsService],
})
export class MentionsModule {}
