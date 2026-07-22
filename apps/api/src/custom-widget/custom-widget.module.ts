import { Module } from '@nestjs/common';
import { CustomWidgetController } from './custom-widget.controller';
import { CustomWidgetService } from './custom-widget.service';

@Module({
  controllers: [CustomWidgetController],
  providers: [CustomWidgetService],
})
export class CustomWidgetModule {}
