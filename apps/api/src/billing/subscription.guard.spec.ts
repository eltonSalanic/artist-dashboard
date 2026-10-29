import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { BoardRoles } from '../common/board-roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { SkipSubscription } from './skip-subscription.decorator';
import { SubscriptionGuard } from './subscription.guard';

const BOARD = '00000000-0000-4000-8000-000000000001';

// Real decorators on stand-in controllers, so the guard reads metadata the
// way it does at runtime rather than through a mocked Reflector.
@BoardRoles('USER')
class BoardRoute {
  handle() {}
}

@BoardRoles('ADMIN')
@SkipSubscription()
class ExemptBoardRoute {
  handle() {}
}

class NoBoardRoute {
  handle() {}
}

describe('SubscriptionGuard', () => {
  const findUnique = jest.fn();
  const prisma = { boardSubscription: { findUnique } };
  let enforced = 'true';
  const billing = new BillingService(
    prisma as unknown as PrismaService,
    { get: () => enforced } as unknown as ConfigService,
  );
  const guard = new SubscriptionGuard(new Reflector(), billing);

  const contextFor = (
    controller: { prototype: { handle: () => void } },
    params: Record<string, unknown> = { boardId: BOARD },
  ): ExecutionContext =>
    ({
      getHandler: () => controller.prototype.handle,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ params }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    findUnique.mockReset();
    enforced = 'true';
  });

  it('answers 402 BOARD_SUBSCRIPTION_REQUIRED on a board without Pro', async () => {
    findUnique.mockResolvedValue(null);

    const error = await guard
      .canActivate(contextFor(BoardRoute))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(402);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'BOARD_SUBSCRIPTION_REQUIRED',
    });
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: BOARD } }),
    );
  });

  it('answers 402 once the subscription has expired', async () => {
    findUnique.mockResolvedValue({ status: 'EXPIRED', currentPeriodEnd: null });

    await expect(guard.canActivate(contextFor(BoardRoute))).rejects.toThrow(
      HttpException,
    );
  });

  it('lets every member of a paid board through', async () => {
    findUnique.mockResolvedValue({
      status: 'CANCELLED',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    await expect(guard.canActivate(contextFor(BoardRoute))).resolves.toBe(true);
  });

  it('reads the board from `:id` on /boards routes', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(contextFor(BoardRoute, { id: BOARD })),
    ).rejects.toThrow(HttpException);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: BOARD } }),
    );
  });

  it('leaves @SkipSubscription routes open', async () => {
    await expect(guard.canActivate(contextFor(ExemptBoardRoute))).resolves.toBe(
      true,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('leaves routes without a board open (sign-in, /me, the board list)', async () => {
    await expect(guard.canActivate(contextFor(NoBoardRoute))).resolves.toBe(
      true,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('checks nothing when BILLING_ENFORCED is off', async () => {
    enforced = 'false';

    await expect(guard.canActivate(contextFor(BoardRoute))).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('treats an unset BILLING_ENFORCED as off', async () => {
    enforced = undefined as unknown as string;

    await expect(guard.canActivate(contextFor(BoardRoute))).resolves.toBe(true);
  });
});
