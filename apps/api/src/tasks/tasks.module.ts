import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  // For StorageService: deleting a task purges its attachments' objects.
  imports: [AttachmentsModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
