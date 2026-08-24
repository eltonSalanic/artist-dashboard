import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { BoardRole } from '@artist/shared';
import { BOARD_ROLE_KEY } from './board-roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthedRequest } from './authed-request';

@Injectable()
export class BoardRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<BoardRole | undefined>(
      BOARD_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = request.user;
    // Express 5 types a route param as `string | string[]`; a repeated param
    // is not a board id, so anything but a plain string falls through to 404.
    const rawBoardId = request.params.boardId ?? request.params.id;
    const boardId = typeof rawBoardId === 'string' ? rawBoardId : undefined;
    if (!user || !boardId) throw new NotFoundException('Board not found');

    const membership = await this.prisma.membership.findUnique({
      where: { boardId_userId: { boardId, userId: user.userId } },
    });
    if (!membership) throw new NotFoundException('Board not found');
    if (required === 'ADMIN' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }

    request.membership = membership;
    return true;
  }
}
