import type { ConfigService } from '@nestjs/config';
import { ExpoPushTransport } from './expo.push-transport';
import { NoopPushTransport } from './noop.push-transport';
import type { PushTransport } from './push-transport';

/**
 * Which way push leaves the building.
 *
 * Noop outside production for the same reason mail goes to Mailpit: a dev run
 * must not be able to buzz a real phone, and the demo seed has to stay safe to
 * re-run.
 *
 * `PUSH_IN_DEV=true` is the one way round that, for testing the phone app
 * against a local API — there is no Mailpit for push, so the only place to see
 * one is a real device. It is opt-in and safe by construction: Expo only
 * delivers to tokens a signed-in phone registered, and the seeded bandmates
 * have none. Never honoured under `NODE_ENV=test`, so a stray `.env` cannot
 * make the suite talk to Expo.
 *
 * In production the real transport is always used. EXPO_ACCESS_TOKEN is
 * genuinely optional — Expo only requires it once a project turns on push
 * security — so there is no credential to gate on, and gating on one would
 * silently disable push for projects that need no token.
 */
export function pushTransportFor(config: ConfigService): PushTransport {
  const env = config.get<string>('NODE_ENV');
  const real =
    env === 'production' ||
    (env !== 'test' && config.get<string>('PUSH_IN_DEV') === 'true');

  return real
    ? new ExpoPushTransport(config.get<string>('EXPO_ACCESS_TOKEN'))
    : new NoopPushTransport();
}
