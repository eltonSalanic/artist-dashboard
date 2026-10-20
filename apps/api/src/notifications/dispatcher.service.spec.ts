import { ConfigService } from '@nestjs/config';
import { DispatcherService } from './dispatcher.service';
import { PrismaService } from '../prisma/prisma.service';
import { NoopTransport } from './mail/noop.transport';
import { NoopPushTransport } from './push/noop.push-transport';

describe('DispatcherService', () => {
  const row = {
    id: 'd1',
    boardId: 'b1',
    userId: 'u1',
    category: 'MENTIONS' as const,
    channel: 'EMAIL' as const,
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
    notificationDelivery: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
    board: { findUniqueOrThrow: jest.fn() },
    membership: { findUnique: jest.fn() },
    notificationPreference: { findMany: jest.fn() },
    emailSuppression: { findUnique: jest.fn() },
    deviceToken: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'WEB_URL' ? 'http://localhost:3000' : undefined,
    ),
    getOrThrow: jest.fn(() => 'test-secret'),
  };

  let transport: NoopTransport;
  let pushTransport: NoopPushTransport;
  let service: DispatcherService;

  /** The `data` of the last status write on the delivery row. */
  const lastUpdate = (): {
    status?: string;
    sendAfter?: Date;
    lastError?: string | null;
  } => {
    const calls = prisma.notificationDelivery.update.mock.calls as [
      {
        data: { status?: string; sendAfter?: Date; lastError?: string | null };
      },
    ][];
    return calls[calls.length - 1][0].data;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    transport = new NoopTransport();
    pushTransport = new NoopPushTransport();
    service = new DispatcherService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      transport,
      pushTransport,
    );

    prisma.notificationDelivery.findMany.mockResolvedValue([{ id: 'd1' }]);
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
    prisma.notificationDelivery.findUnique.mockResolvedValue(row);
    prisma.user.findUnique.mockResolvedValue({ email: 'drums@band.test' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      email: 'drums@band.test',
      displayName: 'Ringo',
    });
    prisma.board.findUniqueOrThrow.mockResolvedValue({
      name: 'Neon Harbor',
      timezone: 'America/Los_Angeles',
    });
    prisma.membership.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.notificationPreference.findMany.mockResolvedValue([]);
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
    prisma.notificationDelivery.updateMany.mockResolvedValue({ count: 0 });

    expect(await service.drain()).toBe(0);
    expect(transport.sent).toHaveLength(0);
    expect(prisma.notificationDelivery.update).not.toHaveBeenCalled();
  });

  it('suppresses instead of sending when the category is muted', async () => {
    prisma.notificationPreference.findMany.mockResolvedValue([
      { channel: 'EMAIL', enabled: false },
    ]);

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
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      ...row,
      attempts: 5,
    });
    jest.spyOn(transport, 'send').mockRejectedValue(new Error('smtp down'));

    await service.drain();

    expect(lastUpdate().status).toBe('FAILED');
  });

  it('fails a delivery naming a template that does not exist', async () => {
    prisma.notificationDelivery.findUnique.mockResolvedValue({
      ...row,
      template: 'nope',
    });

    await service.drain();

    expect(transport.sent).toHaveLength(0);
    expect(lastUpdate().status).toBe('QUEUED');
  });

  describe('push channel', () => {
    const pushRow = { ...row, id: 'd2', channel: 'PUSH' as const };

    beforeEach(() => {
      prisma.notificationDelivery.findUnique.mockResolvedValue(pushRow);
      prisma.deviceToken.count.mockResolvedValue(1);
      prisma.deviceToken.findMany.mockResolvedValue([
        { token: 'tok-a' },
        { token: 'tok-b' },
      ]);
      prisma.deviceToken.deleteMany.mockResolvedValue({ count: 0 });
    });

    it('sends to every device the recipient registered', async () => {
      await service.drain();

      expect(pushTransport.sent).toHaveLength(1);
      expect(pushTransport.sent[0].tokens).toEqual(['tok-a', 'tok-b']);
      // Rendered from the same template as the email, so the two can never
      // describe the same event differently.
      expect(pushTransport.sent[0].title).toBe('Band Wall test email');
      expect(pushTransport.sent[0].idempotencyKey).toBe('mention:m1');
      expect(lastUpdate().status).toBe('SENT');
    });

    it('carries deep-link data so a tap lands somewhere specific', async () => {
      await service.drain();
      expect(pushTransport.sent[0].data).toEqual({
        boardId: 'b1',
        template: 'diagnostic',
      });
    });

    // Without the entity id a tap can only ever open the board root, which for
    // a mention is the one place the comment is not.
    it('passes the entity id through from the payload', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue({
        ...pushRow,
        template: 'comment-mention',
        payload: { taskId: 't7', excerpt: 'check the mix', actorName: 'Dana' },
      });

      await service.drain();

      expect(pushTransport.sent[0].data).toMatchObject({
        boardId: 'b1',
        taskId: 't7',
      });
    });

    // The payload is a render snapshot and can hold a comment excerpt or task
    // title. None of that belongs in a push payload the OS logs.
    it('passes through only whitelisted ids, not the whole payload', async () => {
      prisma.notificationDelivery.findUnique.mockResolvedValue({
        ...pushRow,
        template: 'comment-mention',
        payload: { taskId: 't7', excerpt: 'check the mix', actorName: 'Dana' },
      });

      await service.drain();

      expect(pushTransport.sent[0].data).not.toHaveProperty('excerpt');
      expect(pushTransport.sent[0].data).not.toHaveProperty('actorName');
    });

    // The push analogue of a bounced address: nothing to deliver to. Suppressed
    // rather than retried, because no amount of waiting creates a device.
    it('suppresses when the recipient has no registered device', async () => {
      prisma.deviceToken.count.mockResolvedValue(0);

      await service.drain();

      expect(pushTransport.sent).toHaveLength(0);
      expect(lastUpdate().status).toBe('SUPPRESSED');
      expect(lastUpdate().lastError).toMatch(/no registered device/);
    });

    // A push row must not consult the email suppression list — a bounced
    // address says nothing about whether a phone can be reached.
    it('ignores email suppression for a push row', async () => {
      prisma.emailSuppression.findUnique.mockResolvedValue({
        reason: 'bounce',
      });

      await service.drain();

      expect(lastUpdate().status).toBe('SENT');
    });

    it('deletes tokens Expo reports as gone', async () => {
      jest
        .spyOn(pushTransport, 'send')
        .mockResolvedValue({ invalidTokens: ['tok-b'] });

      await service.drain();

      expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
        where: { token: { in: ['tok-b'] } },
      });
      // A dead token is not a delivery failure — the other device got it.
      expect(lastUpdate().status).toBe('SENT');
    });

    it('does not send mail for a push row', async () => {
      await service.drain();
      expect(transport.sent).toHaveLength(0);
    });

    // Nothing writes PUSH preference rows yet, so a push row reads the email
    // preference. Without this, muting a category would leave the phone
    // buzzing with no way to stop it.
    it('honours an email mute for a push row', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([
        { channel: 'EMAIL', enabled: false },
      ]);

      await service.drain();

      expect(pushTransport.sent).toHaveLength(0);
      expect(lastUpdate().status).toBe('SUPPRESSED');
      expect(lastUpdate().lastError).toMatch(/muted/);
    });

    // An explicit per-channel row wins, so a future push-preferences screen
    // can let someone keep email on and push off.
    it('lets an explicit push preference override the email one', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([
        { channel: 'EMAIL', enabled: false },
        { channel: 'PUSH', enabled: true },
      ]);

      await service.drain();

      expect(pushTransport.sent).toHaveLength(1);
      expect(lastUpdate().status).toBe('SENT');
    });

    // The device list is read after suppressionReason() has already checked it,
    // so an empty list here means a race. It must not be recorded as delivered.
    it('does not record SENT when the last device vanishes mid-flight', async () => {
      prisma.deviceToken.count.mockResolvedValue(1);
      prisma.deviceToken.findMany.mockResolvedValue([]);

      await service.drain();

      expect(pushTransport.sent).toHaveLength(0);
      expect(lastUpdate().status).not.toBe('SENT');
    });
  });
});
