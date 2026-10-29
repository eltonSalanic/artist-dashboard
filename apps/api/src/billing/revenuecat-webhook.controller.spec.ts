import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';

const AUTH = 'Bearer test-webhook-auth-value';
const BODY = {
  api_version: '1.0',
  event: { id: 'evt_1', type: 'RENEWAL', app_user_id: 'board' },
};

// `null` rather than `undefined`, as in the Resend spec: undefined would just
// take the default and quietly test the configured case.
function setup(secret: string | null = AUTH) {
  const handleEvent = jest.fn().mockResolvedValue('applied');
  const controller = new RevenueCatWebhookController(
    { handleEvent } as unknown as BillingService,
    { get: () => secret ?? undefined } as unknown as ConfigService,
  );
  return { controller, handleEvent };
}

describe('RevenueCatWebhookController', () => {
  it('passes an event with the right Authorization header on', async () => {
    const { controller, handleEvent } = setup();

    await expect(controller.receive(AUTH, BODY)).resolves.toEqual({
      received: true,
      outcome: 'applied',
    });
    expect(handleEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt_1', type: 'RENEWAL' }),
    );
  });

  it('rejects a wrong or missing Authorization header', async () => {
    const { controller, handleEvent } = setup();

    await expect(controller.receive('Bearer nope', BODY)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(controller.receive(undefined, BODY)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it('refuses everything when REVENUECAT_WEBHOOK_AUTH is not set', async () => {
    const { controller, handleEvent } = setup(null);

    await expect(controller.receive(AUTH, BODY)).rejects.toThrow(
      BadRequestException,
    );
    expect(handleEvent).not.toHaveBeenCalled();
  });

  it('rejects a body without an event id', async () => {
    const { controller, handleEvent } = setup();

    await expect(
      controller.receive(AUTH, { event: { type: 'RENEWAL' } }),
    ).rejects.toThrow(BadRequestException);
    expect(handleEvent).not.toHaveBeenCalled();
  });
});
