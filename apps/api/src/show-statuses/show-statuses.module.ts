import { Module } from '@nestjs/common';
import { ShowStatusesController } from './show-statuses.controller';
import { ShowStatusesService } from './show-statuses.service';

@Module({
  controllers: [ShowStatusesController],
  providers: [ShowStatusesService],
})
export class ShowStatusesModule {}
