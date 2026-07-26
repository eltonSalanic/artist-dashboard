import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  // For TasksService: deleting an event can take its linked tasks with it.
  imports: [TasksModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
