import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [AttachmentsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
