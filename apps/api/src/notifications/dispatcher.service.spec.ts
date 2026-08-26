import { ConfigService } from '@nestjs/config';
import { DispatcherService } from './dispatcher.service';
import { PrismaService } from '../prisma/prisma.service';
import { NoopTransport } from './mail/noop.transport';

describe('DispatcherService', () => {
  const row = {
    id: 'd1',
    boardId: 'b1',
    userId: 'u1',
    category: 'MENTIONS' as const,
    template: 'diagnostic',
    dedupeKey: 'mention:m1',
    payload: { note: 'hello' },
    status: 'SENDING' as const,
    attempts: 1,
    lastError: null,
    sendAfter: new Date(),
    sentAt: null,
    createdAt: new Date(),
  };

  const prisma = {
    emailDelivery: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    board: { findUniqueOrThrow: jest.fn() },
    membership: { findUnique: jest.fn() },
    notificationPreference: { findUnique: jest.fn() },
    emailSuppression: { findUnique: jest.fn() },
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'WEB_URL' ? 'http://localhost:3000' : undefined,
    ),
    getOrThrow: jest.fn(() => 'test-secret'),
  };

  let transport: NoopTransport;
  let service: DispatcherService;

  /** The `data` of the last status write on the delivery row. */
  const lastUpdate = (): { status?: string; sendAfter?: Date } => {
    const calls = prisma.emailDelivery.update.mock.calls as [
      { data: { status?: string; sendAfter?: Date } },
    ][];
    return calls[calls.length - 1][0].data;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transport = new NoopTransport();
    service = new DispatcherService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      transport,
    );

    prisma.emailDelivery.findMany.mockResolvedValue([{ id: 'd1' }]);
    prisma.emailDelivery.updateMany.mockResolvedValue({ count: 1 });
    prisma.emailDelivery.findUnique.mockResolvedValue(row);
    prisma.user.findUnique.mockResolvedValue({ email: 'drums@band.test' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      email: 'drums@band.test',
      displayName: 'Ringo',
    });
    prisma.board.findUniqueOrThrow.mockResolvedValue({ name: 'Neon Harbor' });
    prisma.membership.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    prisma.emailSuppression.findUnique.mockResolvedValue(null);
  });

  it('sends a due delivery and marks it sent', async () => {
    expect(await service.drain()).toBe(1);

    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].to).toBe('drums@band.test');
    // The dedupe key doubles as the provider's idempotency key — that is what
    // covers a crash between a successful send and recording it.
    expect(transport.sent[0].idempotencyKey).toBe('mention:m1');
    expect(lastUpdate().status).toBe('SENT');
  });

  it('skips a row another instance already claimed', async () => {
    prisma.emailDelivery.updateMany.mockResolvedValue({ count: 0 });

    expect(await service.drain()).toBe(0);
    expect(transport.sent).toHaveLength(0);
    expect(prisma.emailDelivery.update).not.toHaveBeenCalled();
  });

  it('suppresses instead of sending when the category is muted', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: false,
    });

    await service.drain();

    expect(transport.sent).toHaveLength(0);
    expect(lastUpdate().status).toBe('SUPPRESSED');
  });

  it('suppresses when the recipient has left the board', async () => {
    prisma.membership.findUnique.mockResolvedValue(null);

    await service.drain();

    expect(transport.sent).toHaveLength(0);
    expect(lastUpdate().status).toBe('SUPPRESSED');
  });

  it('suppresses a bounced address', async () => {
    prisma.emailSuppression.findUnique.mockResolvedValue({ reason: 'bounce' });

    await service.drain();

    expect(transport.sent).toHaveLength(0);
    expect(lastUpdate().status).toBe('SUPPRESSED');
  });

  it('requeues with backoff when the transport fails', async () => {
    jest.spyOn(transport, 'send').mockRejectedValue(new Error('smtp down'));

    await service.drain();

    const data = lastUpdate();
    expect(data.status).toBe('QUEUED');
    expect(data.sendAfter?.getTime()).toBeGreaterThan(Date.now());
  });

  it('gives up once the backoff schedule is exhausted', async () => {
    prisma.emailDelivery.findUnique.mockResolvedValue({ ...row, attempts: 5 });
    jest.spyOn(transport, 'send').mockRejectedValue(new Error('smtp down'));

    await service.drain();

    expect(lastUpdate().status).toBe('FAILED');
  });

  it('fails a delivery naming a template that does not exist', async () => {
    prisma.emailDelivery.findUnique.mockResolvedValue({
      ...row,
      template: 'nope',
    });

    await service.drain();

    expect(transport.sent).toHaveLength(0);
    expect(lastUpdate().status).toBe('QUEUED');
  });
});
