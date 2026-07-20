import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BoardRolesGuard } from './board-roles.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('BoardRolesGuard', () => {
  const membershipFindUnique = jest.fn();
  const prisma = {
    membership: { findUnique: membershipFindUnique },
  } as unknown as PrismaService;
  const reflector = new Reflector();
  const guard = new BoardRolesGuard(reflector, prisma);

  const contextFor = (
    requiredRole: string | undefined,
    request: Record<string, unknown>,
  ): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    membershipFindUnique.mockReset();
    jest.spyOn(reflector, 'getAllAndOverride').mockReset();
  });

  const mockRole = (role: string | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(role);

  it('passes routes with no board-role requirement', async () => {
    mockRole(undefined);
    await expect(guard.canActivate(contextFor(undefined, {}))).resolves.toBe(true);
  });

  it('rejects non-members with 404 (board existence not leaked)', async () => {
    mockRole('USER');
    membershipFindUnique.mockResolvedValue(null);
    const req = { user: { userId: 'u1' }, params: { boardId: 'b1' } };
    await expect(guard.canActivate(contextFor('USER', req))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects USER members on ADMIN routes with 403', async () => {
    mockRole('ADMIN');
    membershipFindUnique.mockResolvedValue({ id: 'm1', role: 'USER' });
    const req = { user: { userId: 'u1' }, params: { boardId: 'b1' } };
    await expect(guard.canActivate(contextFor('ADMIN', req))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows members and attaches the membership to the request', async () => {
    mockRole('USER');
    const membership = { id: 'm1', role: 'USER' };
    membershipFindUnique.mockResolvedValue(membership);
    const req: Record<string, unknown> = {
      user: { userId: 'u1' },
      params: { boardId: 'b1' },
    };
    await expect(guard.canActivate(contextFor('USER', req))).resolves.toBe(true);
    expect(req.membership).toBe(membership);
  });

  it('resolves the board id from the :id param on /boards routes', async () => {
    mockRole('ADMIN');
    membershipFindUnique.mockResolvedValue({ id: 'm1', role: 'ADMIN' });
    const req = { user: { userId: 'u1' }, params: { id: 'b1' } };
    await expect(guard.canActivate(contextFor('ADMIN', req))).resolves.toBe(true);
    expect(membershipFindUnique).toHaveBeenCalledWith({
      where: { boardId_userId: { boardId: 'b1', userId: 'u1' } },
    });
  });
});
