import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateInviteDto } from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAdminService } from './supabase-admin.service';

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  async create(boardId: string, invitedById: string, dto: CreateInviteDto) {
    const email = dto.email.toLowerCase();

    const existingMember = await this.prisma.membership.findFirst({
      where: { boardId, user: { email } },
    });
    if (existingMember) {
      throw new ConflictException('That person is already a board member');
    }

    const invite = await this.prisma.invite.upsert({
      where: { boardId_email: { boardId, email } },
      update: { role: dto.role, status: 'PENDING' },
      create: { boardId, email, role: dto.role, invitedById },
    });

    const delivery = await this.supabaseAdmin.inviteByEmail(email);
    return { ...invite, delivery };
  }

  list(boardId: string) {
    return this.prisma.invite.findMany({
      where: { boardId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(boardId: string, inviteId: string) {
    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, boardId },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    await this.prisma.invite.delete({ where: { id: invite.id } });
    return { deleted: true };
  }
}
