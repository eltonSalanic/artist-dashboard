import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import type { RevenueCatEvent } from './revenuecat-event';

const USER = '00000000-0000-4000-8000-000000000001';
const OTHER_USER = '00000000-0000-4000-8000-000000000002';
const EXPIRES = Date.parse('2026-11-29T12:00:00Z');

const event = (overrides: Partial<RevenueCatEvent> = {}): RevenueCatEvent => ({
  id: 'evt_1',
  type: 'INITIAL_PURCHASE',
  app_user_id: USER,
  original_app_user_id: USER,
  aliases: [USER],
  product_id: 'bandwall.monthly',
  entitlement_ids: ['band_wall'],
  store: 'APP_STORE',
  environment: 'SANDBOX',
  expiration_at_ms: EXPIRES,
  ...overrides,
});

function setup(enforced = 'true') {
  const prisma = {
    board: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
    billingWebhookEvent: { findUnique: jest.fn(), create: jest.fn() },
    userSubscription: {
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
  // Every uuid the tests use is a real person unless a test says otherwise.
  prisma.user.findMany.mockImplementation(
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
  (prisma.userSubscription.upsert.mock.calls as unknown[][])[0][0] as {
    where: { userId: string };
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
    expect(call.where).toEqual({ userId: USER });
    expect(call.update).toEqual({
      status,
      store: 'APP_STORE',
      productId: 'bandwall.monthly',
      currentPeriodEnd: new Date(EXPIRES),
      willRenew,
      isTrial: false,
      revenueCatAppUserId: USER,
    });
    expect(call.create).toMatchObject({
      userId: USER,
      entitlement: 'band_wall',
    });
  });

  it('counts a free trial as subscribed and marks it as a trial', async () => {
    const { service, prisma } = setup();

    await service.handleEvent(event({ period_type: 'TRIAL' }));

    expect(upserted(prisma).update).toMatchObject({
      status: 'ACTIVE',
      isTrial: true,
      currentPeriodEnd: new Date(EXPIRES),
    });
  });

  it('clears the trial flag when the first paid period renews', async () => {
    const { service, prisma } = setup();

    await service.handleEvent(
      event({ type: 'RENEWAL', period_type: 'NORMAL' }),
    );

    expect(upserted(prisma).update).toMatchObject({
      status: 'ACTIVE',
      isTrial: false,
    });
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

  it('finds the person through an alias when the purchase began anonymous', async () => {
    const { service, prisma } = setup();

    await service.handleEvent(
      event({
        app_user_id: '$RCAnonymousID:abc',
        original_app_user_id: '$RCAnonymousID:abc',
        aliases: ['$RCAnonymousID:abc', USER],
      }),
    );

    expect(upserted(prisma).where).toEqual({ userId: USER });
  });

  it('records but does not apply an event for an id that is no user', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany.mockResolvedValue([]);

    await expect(service.handleEvent(event())).resolves.toBe('unknown_user');
    expect(prisma.billingWebhookEvent.create).toHaveBeenCalled();
    expect(prisma.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it('ignores events for another entitlement', async () => {
    const { service, prisma } = setup();

    await expect(
      service.handleEvent(event({ entitlement_ids: ['something_else'] })),
    ).resolves.toBe('ignored');
    expect(prisma.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it('ignores event types it has no mapping for, but records them', async () => {
    const { service, prisma } = setup();

    await expect(service.handleEvent(event({ type: 'TEST' }))).resolves.toBe(
      'ignored',
    );
    expect(prisma.billingWebhookEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt_1', type: 'TEST', userId: USER },
    });
    expect(prisma.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it('moves the subscription to the receiving person on TRANSFER', async () => {
    const { service, prisma } = setup();
    prisma.userSubscription.findUnique.mockResolvedValue({
      userId: USER,
      entitlement: 'band_wall',
      status: 'ACTIVE',
      store: 'APP_STORE',
      productId: 'bandwall.yearly',
      currentPeriodEnd: new Date(EXPIRES),
      willRenew: true,
      isTrial: true,
    });

    await expect(
      service.handleEvent(
        event({
          type: 'TRANSFER',
          app_user_id: undefined,
          original_app_user_id: undefined,
          aliases: undefined,
          transferred_from: [USER],
          transferred_to: [OTHER_USER],
        }),
      ),
    ).resolves.toBe('applied');

    expect(upserted(prisma).where).toEqual({ userId: OTHER_USER });
    expect(upserted(prisma).update).toMatchObject({
      status: 'ACTIVE',
      productId: 'bandwall.yearly',
      isTrial: true,
      revenueCatAppUserId: OTHER_USER,
    });
    expect(prisma.userSubscription.updateMany).toHaveBeenCalledWith({
      where: { userId: { in: [USER] } },
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
      data: { id: 'evt_1', type: 'INITIAL_PURCHASE', userId: USER },
    });
  });

  it('skips an event id it has already processed', async () => {
    const { service, prisma } = setup();
    prisma.billingWebhookEvent.findUnique.mockResolvedValue({ id: 'evt_1' });

    await expect(service.handleEvent(event())).resolves.toBe('duplicate');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it('lets a failure through so the event is not recorded and RevenueCat retries', async () => {
    const { service, prisma } = setup();
    prisma.userSubscription.upsert.mockRejectedValue(new Error('db down'));

    await expect(service.handleEvent(event())).rejects.toThrow('db down');
  });
});

describe('BillingService access', () => {
  const BOARD = '00000000-0000-4000-8000-0000000000b1';
  const paidUp = {
    status: 'GRACE',
    currentPeriodEnd: new Date(Date.now() + 86_400_000),
  };

  it('opens a band while its owner is subscribed', async () => {
    const { service, prisma } = setup();
    prisma.board.findUnique.mockResolvedValue({
      owner: { subscription: paidUp },
    });

    await expect(service.isPro(BOARD)).resolves.toBe(true);
  });

  it('locks a band once its owner lapses, or has no account left', async () => {
    const { service, prisma } = setup();
    prisma.board.findUnique.mockResolvedValueOnce({
      owner: { subscription: { status: 'EXPIRED', currentPeriodEnd: null } },
    });
    await expect(service.isPro(BOARD)).resolves.toBe(false);

    prisma.board.findUnique.mockResolvedValueOnce({ owner: null });
    await expect(service.isPro(BOARD)).resolves.toBe(false);
  });

  it('requires nothing while billing is not enforced', async () => {
    const { service, prisma } = setup('false');

    await expect(service.requiresSubscription(BOARD)).resolves.toBe(false);
    await expect(service.ownershipBlock(USER)).resolves.toBeNull();
    expect(prisma.board.findUnique).not.toHaveBeenCalled();
  });

  it('wants a subscription before someone can own a band', async () => {
    const { service, prisma } = setup();
    prisma.userSubscription.findUnique.mockResolvedValue(null);

    await expect(service.ownershipBlock(USER)).resolves.toBe('NO_SUBSCRIPTION');
  });

  it('lets a subscription cover one band', async () => {
    const { service, prisma } = setup();
    prisma.userSubscription.findUnique.mockResolvedValue(paidUp);
    prisma.board.findFirst.mockResolvedValueOnce({ id: BOARD });
    await expect(service.ownershipBlock(USER)).resolves.toBe(
      'ALREADY_OWNS_BAND',
    );

    prisma.board.findFirst.mockResolvedValueOnce(null);
    await expect(service.ownershipBlock(USER)).resolves.toBeNull();
  });

  it("gives a member the band state but not the owner's billing details", async () => {
    const { service, prisma } = setup();
    prisma.board.findUnique.mockResolvedValue({
      ownerId: OTHER_USER,
      owner: {
        displayName: 'Sam',
        subscription: {
          status: 'ACTIVE',
          store: 'APP_STORE',
          productId: 'bandwall.yearly',
          currentPeriodEnd: new Date(Date.now() + 86_400_000),
          willRenew: true,
          isTrial: true,
        },
      },
    });

    await expect(service.getForBoard(BOARD, USER)).resolves.toEqual({
      boardId: BOARD,
      isPro: true,
      required: false,
      isOwner: false,
      ownerId: OTHER_USER,
      ownerName: 'Sam',
      status: 'ACTIVE',
      store: null,
      productId: null,
      currentPeriodEnd: null,
      willRenew: false,
      isTrial: false,
    });
  });

  it("tells a locked band's owner it is theirs to renew", async () => {
    const { service, prisma } = setup();
    prisma.board.findUnique.mockResolvedValue({
      ownerId: USER,
      owner: { displayName: 'Sam', subscription: null },
    });

    await expect(service.getForBoard(BOARD, USER)).resolves.toMatchObject({
      isPro: false,
      required: true,
      isOwner: true,
    });
  });
});

describe('BillingService.syncFromRevenueCat', () => {
  const realFetch = global.fetch;
  const fetchMock = jest.fn();

  const answers = (subscriber: object, ok = true) =>
    fetchMock.mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      json: () => Promise.resolve({ subscriber }),
    });
  const active = {
    entitlements: {
      band_wall: {
        expires_date: new Date(Date.now() + 86_400_000).toISOString(),
        product_identifier: 'band_wall_monthly',
      },
    },
    subscriptions: {
      band_wall_monthly: { period_type: 'trial', store: 'app_store' },
    },
  };

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });
  afterAll(() => {
    global.fetch = realFetch;
  });

  function subject(key: string | undefined = 'sk_test') {
    const { prisma } = setup();
    prisma.userSubscription.findUnique.mockResolvedValue(null);
    prisma.board.findFirst.mockResolvedValue(null);
    const service = new BillingService(
      prisma as unknown as PrismaService,
      {
        get: (name: string) =>
          name === 'REVENUECAT_SECRET_API_KEY' ? key : 'true',
      } as unknown as ConfigService,
    );
    return { service, prisma };
  }

  it('saves an active entitlement the way the webhook does', async () => {
    answers(active);
    const { service, prisma } = subject();
    await service.syncFromRevenueCat(USER);

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: { Authorization: string } },
    ];
    expect(url).toContain(`/subscribers/${USER}`);
    expect(init.headers.Authorization).toBe('Bearer sk_test');
    expect(upserted(prisma).create).toMatchObject({
      entitlement: 'band_wall',
      status: 'ACTIVE',
      store: 'APP_STORE',
      productId: 'band_wall_monthly',
      isTrial: true,
      willRenew: true,
      revenueCatAppUserId: USER,
    });
  });

  it('never takes access away', async () => {
    answers({ entitlements: {}, subscriptions: {} });
    const { service, prisma } = subject();
    await service.syncFromRevenueCat(USER);
    expect(prisma.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it('answers as before with no key, without calling RevenueCat', async () => {
    const { service, prisma } = subject('');
    await expect(service.syncFromRevenueCat(USER)).resolves.toMatchObject({
      isPro: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.userSubscription.upsert).not.toHaveBeenCalled();
  });

  it('answers as before when RevenueCat fails', async () => {
    answers({}, false);
    const { service } = subject();
    await expect(service.syncFromRevenueCat(USER)).resolves.toMatchObject({
      isPro: false,
    });
  });
});
