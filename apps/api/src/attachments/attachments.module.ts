import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, StorageService],
  // CommentsModule purges a deleted comment's objects through this.
  exports: [StorageService],
})
export class AttachmentsModule {}
