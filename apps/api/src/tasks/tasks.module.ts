import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  // For StorageService: deleting a task purges its attachments' objects.
  imports: [AttachmentsModule],
  controllers: [TasksController],
  providers: [TasksService],
  // Goals, events and the archive delete their linked tasks through it.
  exports: [TasksService],
})
export class TasksModule {}
