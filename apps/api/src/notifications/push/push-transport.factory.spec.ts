import type { ConfigService } from '@nestjs/config';
import { ExpoPushTransport } from './expo.push-transport';
import { NoopPushTransport } from './noop.push-transport';
import { pushTransportFor } from './push-transport.factory';

const configWith = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('pushTransportFor', () => {
  it('sends for real in production', () => {
    expect(
      pushTransportFor(configWith({ NODE_ENV: 'production' })),
    ).toBeInstanceOf(ExpoPushTransport);
  });

  it('is a no-op in development by default', () => {
    expect(
      pushTransportFor(configWith({ NODE_ENV: 'development' })),
    ).toBeInstanceOf(NoopPushTransport);
  });

  // The phone's development build is the only place to see a push locally.
  it('sends for real in development when PUSH_IN_DEV is true', () => {
    expect(
      pushTransportFor(
        configWith({ NODE_ENV: 'development', PUSH_IN_DEV: 'true' }),
      ),
    ).toBeInstanceOf(ExpoPushTransport);
  });

  // Anything short of the literal opt-in stays silent.
  it('ignores a PUSH_IN_DEV that is not exactly "true"', () => {
    expect(
      pushTransportFor(
        configWith({ NODE_ENV: 'development', PUSH_IN_DEV: '1' }),
      ),
    ).toBeInstanceOf(NoopPushTransport);
  });

  // A stray .env must not make the suite talk to Expo.
  it('never sends under test, even with PUSH_IN_DEV set', () => {
    expect(
      pushTransportFor(configWith({ NODE_ENV: 'test', PUSH_IN_DEV: 'true' })),
    ).toBeInstanceOf(NoopPushTransport);
  });
});
