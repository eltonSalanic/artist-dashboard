import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'standardwebhooks';
import { ResendWebhookController } from './resend-webhook.controller';
import { SuppressionsService } from './suppressions.service';
import { PrismaService } from '../prisma/prisma.service';

// Svix secrets are base64 after the prefix; the value itself is arbitrary.
const SECRET = `whsec_${Buffer.from('test-signing-key-32-bytes-long!!').toString('base64')}`;

const PAYLOAD = JSON.stringify({
  type: 'email.bounced',
  data: { to: ['dead@band.test'], bounce: { type: 'Permanent' } },
});

function signed(payload = PAYLOAD, secret = SECRET) {
  const id = 'msg_test';
  const timestamp = new Date();
  const signature = new Webhook(secret).sign(id, timestamp, payload);
  return {
    rawBody: Buffer.from(payload, 'utf8'),
    headers: {
      'svix-id': id,
      'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
      'svix-signature': signature,
    },
  } as unknown as RawBodyRequest<Request>;
}

// `null` rather than `undefined`: passing undefined would just take the
// default and quietly test the configured case instead.
function setup(secret: string | null = SECRET) {
  const prisma = { emailSuppression: { upsert: jest.fn() } };
  const suppressions = new SuppressionsService(
    prisma as unknown as PrismaService,
  );
  const controller = new ResendWebhookController(suppressions, {
    get: () => secret ?? undefined,
  } as unknown as ConfigService);
  return { controller, prisma };
}

describe('ResendWebhookController', () => {
  it('accepts a correctly signed event and suppresses the address', async () => {
    const { controller, prisma } = setup();

    await expect(controller.receive(signed())).resolves.toEqual({
      received: true,
      suppressed: 1,
    });
    expect(prisma.emailSuppression.upsert).toHaveBeenCalledTimes(1);
  });

  it('rejects a payload signed with someone else’s secret', async () => {
    const { controller, prisma } = setup();
    const forged = signed(
      PAYLOAD,
      `whsec_${Buffer.from('an-entirely-different-signing-key').toString('base64')}`,
    );

    await expect(controller.receive(forged)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('rejects a body that was altered after signing', async () => {
    const { controller, prisma } = setup();
    const request = signed();
    (request as { rawBody: Buffer }).rawBody = Buffer.from(
      JSON.stringify({
        type: 'email.bounced',
        data: { to: ['someone-else@band.test'] },
      }),
    );

    await expect(controller.receive(request)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });

  it('rejects an unsigned request', async () => {
    const { controller } = setup();
    const bare = {
      rawBody: Buffer.from(PAYLOAD),
      headers: {},
    } as unknown as RawBodyRequest<Request>;

    await expect(controller.receive(bare)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses everything when no secret is configured, rather than trusting it', async () => {
    const { controller, prisma } = setup(null);

    await expect(controller.receive(signed())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.emailSuppression.upsert).not.toHaveBeenCalled();
  });
});
