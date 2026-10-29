import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import type { RevenueCatEvent } from './revenuecat-event';

const BOARD = '00000000-0000-4000-8000-000000000001';
const OTHER_BOARD = '00000000-0000-4000-8000-000000000002';
const EXPIRES = Date.parse('2026-11-29T12:00:00Z');

const event = (overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent => ({
  id: 'evt_1',
  type: 'INITIAL_PURCHASE',
  app_user_id: BOARD,
  original_app_user_id: BOARD,
  aliases: [BOARD],
  product_id: 'band_pro_monthly',
  entitlement_ids: ['band_wall'],
  store: 'APP_STORE',
  environment: 'SANDBOX',
  expiration_at_ms: EXPIRES,
  ...overrides,
});

function setup(enforced = 'true') {
  const prisma = {
    board: { findMany: jest.fn() },
    billingWebhookEvent: { findUnique: jest.fn(), create: jest.fn() },
    boardSubscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  // The interactive transaction runs its callback against the same mocks.
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  // Every uuid the tests use is a real board unless a test says otherwise.
  prisma.board.findMany.mockImplementation(
    ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })),
  );
  const service = new BillingService(
    prisma as unknown as PrismaService,
    { get: () => enforced } as unknown as ConfigService,
  );
  return { service, prisma };
}

const upserted = (prisma: ReturnType<typeof setup>['prisma']) =>
  (prisma.boardSubscription.upsert.mock.calls as unknown[][])[0][0] as {
    where: { boardId: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  };

describe('BillingService webhook mapping', () => {
  it.each([
    ['INITIAL_PURCHASE', 'ACTIVE', true],
    ['RENEWAL', 'ACTIVE', true],
    ['UNCANCELLATION', 'ACTIVE', true],
    ['PRODUCT_CHANGE', 'ACTIVE', true],
    ['BILLING_ISSUE', 'GRACE', true],
    ['CANCELLATION', 'CANCELLED', false],
    ['EXPIRATION', 'EXPIRED', false],
  ])('%s writes status %s', async (type, status, willRenew) => {
    const { service, prisma } = setup();

    await expect(service.handleEvent(event({ type }))).resolves.toBe('applied');

    const call = upserted(prisma);
    expect(call.where).toEqual({ boardId: BOARD });
    expect(call.update).toEqual({
      status,
      store: 'APP_STORE',
      productId: 'band_pro_monthly',
      currentPeriodEnd: new Date(EXPIRES),
      willRenew,
      revenueCatAppUserId: BOARD,
    });
    expect(call.create).toMatchObject({ boardId: BOARD, entitlement: 'band_wall' });
  });

  it('keeps the paid period on a cancellation, so access lasts until EXPIRATION', async () => {
    const { service, prisma } = setup();

    await service.handleEvent(event({ type: 'CANCELLATION' }));

    expect(upserted(prisma).update.currentPeriodEnd).toEqual(new Date(EXPIRES));
  });

  it.each([
    ['APP_STORE', 'APP_STORE'],
    ['PLAY_STORE', 'PLAY_STORE'],
    ['STRIPE', 'STRIPE'],
    // Web Billing charges through the connected Stripe account.
    ['RC_BILLING', 'STRIPE'],
    ['PROMOTIONAL', 'PROMOTIONAL'],
  ])('maps RevenueCat store %s to %s', async (store, expected) => {
    const { service, prisma } = setup();

    await service.handleEvent(event({ store }));

    expect(upserted(prisma).update.store).toBe(expected);
  });

  it('finds the board through an alias when the purchase began anonymous', async () => {
    const { service, prisma } = setup();

    await service.handleEvent(
      event({
        app_user_id: '$RCAnonymousID:abc',
        original_app_user_id: '$RCAnonymousID:abc',
        aliases: ['$RCAnonymousID:abc', BOARD],
      }),
    );

    expect(upserted(prisma).where).toEqual({ boardId: BOARD });
  });

  it('records but does not apply an event for an id that is no board', async () => {
    const { service, prisma } = setup();
    prisma.board.findMany.mockResolvedValue([]);

    await expect(service.handleEvent(event())).resolves.toBe('unknown_board');
    expect(prisma.billingWebhookEvent.create).toHaveBeenCalled();
    expect(prisma.boardSubscription.upsert).not.toHaveBeenCalled();
  });

  it('ignores events for another entitlement', async () => {
    const { service, prisma } = setup();

    await expect(
      service.handleEvent(event({ entitlement_ids: ['something_else'] })),
    ).resolves.toBe('ignored');
    expect(prisma.boardSubscription.upsert).not.toHaveBeenCalled();
  });

  it('ignores event types it has no mapping for, but records them', async () => {
    const { service, prisma } = setup();

    await expect(service.handleEvent(event({ type: 'TEST' }))).resolves.toBe(
      'ignored',
    );
    expect(prisma.billingWebhookEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt_1', type: 'TEST', boardId: BOARD },
    });
    expect(prisma.boardSubscription.upsert).not.toHaveBeenCalled();
  });

  it('moves the subscription to the receiving board on TRANSFER', async () => {
    const { service, prisma } = setup();
    prisma.boardSubscription.findUnique.mockResolvedValue({
      boardId: BOARD,
      entitlement: 'band_wall',
      status: 'ACTIVE',
      store: 'APP_STORE',
      productId: 'band_pro_yearly',
      currentPeriodEnd: new Date(EXPIRES),
      willRenew: true,
    });

    await expect(
      service.handleEvent(
        event({
          type: 'TRANSFER',
          app_user_id: undefined,
          original_app_user_id: undefined,
          aliases: undefined,
          transferred_from: [BOARD],
          transferred_to: [OTHER_BOARD],
        }),
      ),
    ).resolves.toBe('applied');

    expect(upserted(prisma).where).toEqual({ boardId: OTHER_BOARD });
    expect(upserted(prisma).update).toMatchObject({
      status: 'ACTIVE',
      productId: 'band_pro_yearly',
      revenueCatAppUserId: OTHER_BOARD,
    });
    expect(prisma.boardSubscription.updateMany).toHaveBeenCalledWith({
      where: { boardId: { in: [BOARD] } },
      data: { status: 'EXPIRED', willRenew: false },
    });
  });
});

describe('BillingService webhook idempotency', () => {
  it('records the event id in the same transaction as the change', async () => {
    const { service, prisma } = setup();

    await service.handleEvent(event());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.billingWebhookEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt_1', type: 'INITIAL_PURCHASE', boardId: BOARD },
    });
  });

  it('skips an event id it has already processed', async () => {
    const { service, prisma } = setup();
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({ id: 'evt_1' });

    await expect(service.handleEvent(event())).resolves.toBe('duplicate');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.boardSubscription.upsert).not.toHaveBeenCalled();
  });

  it('lets a failure through so the event is not recorded and RevenueCat retries', async () => {
    const { service, prisma } = setup();
    prisma.boardSubscription.upsert.mockRejectedValue(new Error('db down'));

    await expect(service.handleEvent(event())).rejects.toThrow('db down');
  });
});

describe('BillingService access', () => {
  it('reports Pro from the stored row', async () => {
    const { service, prisma } = setup();
    prisma.boardSubscription.findUnique.mockResolvedValue({
      status: 'GRACE',
      currentPeriodEnd: new Date(Date.now() + 86_400_000),
    });

    await expect(service.isPro(BOARD)).resolves.toBe(true);
  });

  it('requires nothing while billing is not enforced', async () => {
    const { service, prisma } = setup('false');

    await expect(service.requiresSubscription(BOARD)).resolves.toBe(false);
    expect(prisma.boardSubscription.findUnique).not.toHaveBeenCalled();
  });

  it('describes a board with no purchase for the apps', async () => {
    const { service, prisma } = setup();
    prisma.boardSubscription.findUnique.mockResolvedValue(null);

    await expect(service.getForBoard(BOARD)).resolves.toEqual({
      boardId: BOARD,
      isPro: false,
      required: true,
      status: null,
      store: null,
      productId: null,
      currentPeriodEnd: null,
      willRenew: false,
    });
  });
});
