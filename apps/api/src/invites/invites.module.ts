import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { SupabaseAdminService } from './supabase-admin.service';

@Module({
  controllers: [InvitesController],
  providers: [InvitesService, SupabaseAdminService],
})
export class InvitesModule {}
