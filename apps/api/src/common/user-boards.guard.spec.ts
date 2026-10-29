import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserBoardsGuard } from './user-boards.guard';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import type { AuthedRequest } from './authed-request';

describe('UserBoardsGuard', () => {
  const findMany = jest.fn();
  const subscriptions = jest.fn();
  const prisma = {
    membership: { findMany },
    boardSubscription: { findMany: subscriptions },
  };
  let enforced = 'false';
  const billing = new BillingService(
    prisma as unknown as PrismaService,
    { get: () => enforced } as unknown as ConfigService,
  );
  const guard = new UserBoardsGuard(
    prisma as unknown as PrismaService,
    billing,
  );

  const contextFor = (request: Partial<AuthedRequest>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    enforced = 'false';
  });

  it('attaches every board the caller belongs to', async () => {
    findMany.mockResolvedValue([{ boardId: 'b1' }, { boardId: 'b2' }]);
    const request: Partial<AuthedRequest> = { user: { userId: 'u1' } as never };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.userBoardIds).toEqual(['b1', 'b2']);
  });

  /**
   * The list is derived from Membership and from the authenticated user id
   * only. If it could be influenced by anything the client sends, it would stop
   * being authorisation.
   */
  it('reads the membership set from the authenticated user, not the request', async () => {
    findMany.mockResolvedValue([]);
    await guard.canActivate(
      contextFor({
        user: { userId: 'u1' } as never,
        // All attacker-controlled, all must be ignored.
        query: { userId: 'u2', boardId: 'b9' },
        body: { userId: 'u2' },
        params: { boardId: 'b9' },
      }),
    );

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { boardId: true },
    });
  });

  // Legitimate state: someone mid-invite belongs to no board. `{ in: [] }`
  // matches nothing, which is the correct answer for them.
  it('attaches an empty array when the caller has no boards', async () => {
    findMany.mockResolvedValue([]);
    const request: Partial<AuthedRequest> = { user: { userId: 'u1' } as never };

    await guard.canActivate(contextFor(request));

    expect(request.userBoardIds).toEqual([]);
  });

  it('refuses a request with no authenticated user', async () => {
    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it('drops boards without Band Pro when billing is enforced', async () => {
    enforced = 'true';
    findMany.mockResolvedValue([{ boardId: 'b1' }, { boardId: 'b2' }]);
    subscriptions.mockResolvedValue([
      { boardId: 'b2', status: 'ACTIVE', currentPeriodEnd: null },
    ]);
    const request: Partial<AuthedRequest> = { user: { userId: 'u1' } as never };

    await guard.canActivate(contextFor(request));

    expect(request.userBoardIds).toEqual(['b2']);
  });

  it('keeps every board when billing is not enforced', async () => {
    findMany.mockResolvedValue([{ boardId: 'b1' }]);
    const request: Partial<AuthedRequest> = { user: { userId: 'u1' } as never };

    await guard.canActivate(contextFor(request));

    expect(request.userBoardIds).toEqual(['b1']);
    expect(subscriptions).not.toHaveBeenCalled();
  });
});
