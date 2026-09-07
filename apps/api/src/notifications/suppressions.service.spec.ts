import { SuppressionsService } from './suppressions.service';
import { PrismaService } from '../prisma/prisma.service';

const bounced = (bounce?: { type?: string }) => ({
  type: 'email.bounced',
  data: { to: ['dead@band.test'], ...(bounce ? { bounce } : {}) },
});

function setup() {
  const prisma = { emailSuppression: { upsert: jest.fn() } };
  const service = new SuppressionsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const upsertedFor = (prisma: {
  emailSuppression: { upsert: jest.Mock };
}): { email: string; reason: string }[] =>
  prisma.emailSuppression.upsert.mock.calls.map(
    ([args]: [{ create: { email: string; reason: string } }]) => args.create,
  );

describe('SuppressionsService', () => {
  it('suppresses a permanent bounce', async () => {
    const { service, prisma } = setup();

    await expect(
      service.handle(bounced({ type: 'Permanent' })),
    ).resolves.toEqual(['dead@band.test']);
    expect(upsertedFor(prisma)).toEqual([
      { email: 'dead@band.test', reason: 'bounce' },
    ]);
  });

  it('ignores a transient bounce — a full mailbox is not a dead address', async () => {
    const { service, prisma } = setup();

    await expect(
      service.handle(bounced({ type: 'Transient' })),
    ).resolves.toEqual([]);
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('suppresses a bounce with no type — the event itself means permanent', async () => {
    const { service, prisma } = setup();

    await service.handle(bounced());
    expect(upsertedFor(prisma)).toHaveLength(1);
  });

  it('suppresses a complaint', async () => {
    const { service, prisma } = setup();

    await service.handle({
      type: 'email.complained',
      data: { to: ['annoyed@band.test'] },
    });
    expect(upsertedFor(prisma)).toEqual([
      { email: 'annoyed@band.test', reason: 'complaint' },
    ]);
  });

  it('ignores the events that are only telemetry', async () => {
    const { service, prisma } = setup();

    for (const type of ['email.sent', 'email.delivered', 'email.opened']) {
      await service.handle({ type, data: { to: ['drums@band.test'] } });
    }
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('handles every impacted recipient, normalised', async () => {
    const { service, prisma } = setup();

    await service.handle({
      type: 'email.complained',
      data: { to: [' Bass@Band.test ', 'drums@band.test'] },
    });
    expect(upsertedFor(prisma).map((row) => row.email)).toEqual([
      'bass@band.test',
      'drums@band.test',
    ]);
  });

  it('keeps the first reason when an address bounces and then complains', async () => {
    const { service, prisma } = setup();

    await service.handle(bounced({ type: 'Permanent' }));
    const [args] = prisma.emailSuppression.upsert.mock.calls[0] as [
      { update: unknown },
    ];
    expect(args.update).toEqual({});
  });

  it('survives a payload with no recipients', async () => {
    const { service, prisma } = setup();

    await expect(
      service.handle({ type: 'email.bounced', data: {} }),
    ).resolves.toEqual([]);
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });
});
