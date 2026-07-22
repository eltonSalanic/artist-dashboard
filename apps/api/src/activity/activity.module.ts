import { Global, Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

/**
 * Global because nearly every domain service logs to the feed; making each
 * one import ActivityModule would be noise.
 */
@Global()
@Module({
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
