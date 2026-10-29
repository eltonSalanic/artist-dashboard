import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { InviteMailer } from './invite-mailer.service';

@Module({
  controllers: [InvitesController],
  providers: [InvitesService, InviteMailer],
})
export class InvitesModule {}
