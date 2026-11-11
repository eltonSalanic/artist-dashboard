import { socialProviders } from './social-providers';

describe('socialProviders', () => {
  it('turns on Apple for the bundle ID alone, which is all the phone needs', () => {
    const { apple } = socialProviders({ apple: { bundleId: 'com.bandwall.app' } });
    expect(apple).toMatchObject({
      clientId: 'com.bandwall.app',
      appBundleIdentifier: 'com.bandwall.app',
      audience: ['com.bandwall.app'],
    });
  });

  it('accepts web tokens too once a Services ID is set', () => {
    const { apple } = socialProviders({
      apple: { bundleId: 'com.bandwall.app', serviceId: 'com.bandwall.web' },
    });
    expect(apple?.clientId).toBe('com.bandwall.web');
    expect(apple?.audience).toEqual(['com.bandwall.app', 'com.bandwall.web']);
  });

  it('leaves Google off until a client ID is set', () => {
    expect(socialProviders({ google: { clientIds: [] } })).not.toHaveProperty('google');
    expect(socialProviders({ google: { clientIds: ['ios', 'web'] } }).google).toEqual({
      clientId: ['ios', 'web'],
    });
  });
});
