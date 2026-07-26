import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';

@Module({
  // For TasksService.collectTaskTree: subtasks follow their parent in and out
  // of the archive.
  imports: [TasksModule],
  controllers: [ArchiveController],
  providers: [ArchiveService],
})
export class ArchiveModule {}
