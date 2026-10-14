import { configureApiClient, resetApiClient } from '../client';
import { registerDevice, unregisterDevice } from './devices';

describe('device registration', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetApiClient();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    configureApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: async () => 'tok',
      notify: { error: jest.fn(), success: jest.fn() },
    });
  });

  it('posts the token and platform', async () => {
    await registerDevice({ token: 'ExponentPushToken[abc]', platform: 'IOS' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/me/devices');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      token: 'ExponentPushToken[abc]',
      platform: 'IOS',
    });
  });

  // Raw brackets in a path segment are not valid URL characters; encoded,
  // Express hands the controller the original token back.
  it('encodes the token into the path when unregistering', async () => {
    await unregisterDevice('ExponentPushToken[abc]');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/me/devices/ExponentPushToken%5Babc%5D');
    expect(init.method).toBe('DELETE');
  });
});
