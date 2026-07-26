import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  // For TasksService: deleting a goal can take its linked tasks with it.
  imports: [TasksModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
