import { ExpoPushTransport } from './expo.push-transport';

describe('ExpoPushTransport', () => {
  const fetchMock = jest.fn();
  const transport = new ExpoPushTransport();

  const push = {
    tokens: ['tok-a', 'tok-b'],
    title: 'Dana mentioned you',
    body: 'can you check the mix?',
    idempotencyKey: 'mention:c1:u1',
  };

  const ok = (tickets: unknown[]) => ({
    ok: true,
    json: async () => ({ data: tickets }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('posts all tokens in one request with the dedupe key as the id', async () => {
    fetchMock.mockResolvedValue(ok([{ status: 'ok' }, { status: 'ok' }]));

    await expect(transport.send(push)).resolves.toEqual({ invalidTokens: [] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(JSON.parse(init.body)).toMatchObject({
      to: ['tok-a', 'tok-b'],
      title: 'Dana mentioned you',
      body: 'can you check the mix?',
      id: 'mention:c1:u1',
    });
  });

  // DeviceNotRegistered is permanent — the dispatcher deletes these rather
  // than retrying them forever.
  it('reports DeviceNotRegistered tokens as invalid', async () => {
    fetchMock.mockResolvedValue(
      ok([
        { status: 'ok' },
        {
          status: 'error',
          message: 'not registered',
          details: { error: 'DeviceNotRegistered', expoPushToken: 'tok-b' },
        },
      ]),
    );

    await expect(transport.send(push)).resolves.toEqual({
      invalidTokens: ['tok-b'],
    });
  });

  // Anything else is a transient provider problem; keeping the token means the
  // next notification still tries that device.
  it('does not invalidate a token for a non-registration error', async () => {
    fetchMock.mockResolvedValue(
      ok([
        { status: 'ok' },
        {
          status: 'error',
          message: 'too big',
          details: { error: 'MessageTooBig', expoPushToken: 'tok-b' },
        },
      ]),
    );

    await expect(transport.send(push)).resolves.toEqual({ invalidTokens: [] });
  });

  // Tickets come back positionally, so a ticket with no echoed token still has
  // to be attributable to the right device.
  it('falls back to position when a ticket omits the token', async () => {
    fetchMock.mockResolvedValue(
      ok([
        { status: 'ok' },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
      ]),
    );

    await expect(transport.send(push)).resolves.toEqual({
      invalidTokens: ['tok-b'],
    });
  });

  // Thrown so the dispatcher's existing backoff handles it.
  it('throws on a non-2xx so the delivery retries', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    await expect(transport.send(push)).rejects.toThrow(/503/);
  });

  it('chunks beyond 100 recipients into separate requests', async () => {
    fetchMock.mockResolvedValue(ok([]));
    const tokens = Array.from({ length: 150 }, (_, i) => `tok-${i}`);

    await transport.send({ ...push, tokens });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).to).toHaveLength(100);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).to).toHaveLength(50);
  });

  it('omits the Authorization header when no access token is configured', async () => {
    fetchMock.mockResolvedValue(ok([]));
    await transport.send(push);
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      'Authorization',
    );

    fetchMock.mockResolvedValue(ok([]));
    await new ExpoPushTransport('secret-tok').send(push);
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      Authorization: 'Bearer secret-tok',
    });
  });
});
