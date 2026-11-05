import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [StorageModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
  // Boards, tasks, events and comments purge deleted objects through
  // StorageService, which they get by importing this module.
  exports: [StorageModule],
})
export class AttachmentsModule {}
