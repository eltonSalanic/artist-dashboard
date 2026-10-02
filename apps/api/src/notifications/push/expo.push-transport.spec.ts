import { ExpoPushTransport } from './expo.push-transport';

/** The shape our transport actually passes to fetch. */
interface SentRequest {
  method: string;
  headers: Record<string, string>;
  body: string;
}

describe('ExpoPushTransport', () => {
  const fetchMock = jest.fn<Promise<unknown>, [string, SentRequest]>();
  const transport = new ExpoPushTransport();

  /** The nth request, with its JSON body already parsed. */
  const sent = (index = 0) => {
    const [url, init] = fetchMock.mock.calls[index];
    return {
      url,
      headers: init.headers,
      body: JSON.parse(init.body) as Record<string, unknown>,
    };
  };

  const push = {
    tokens: ['tok-a', 'tok-b'],
    title: 'Dana mentioned you',
    body: 'can you check the mix?',
    idempotencyKey: 'mention:c1:u1',
  };

  const ok = (tickets: unknown[]) => ({
    ok: true,
    json: () => Promise.resolve({ data: tickets }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // The mock is typed to what this transport actually sends, which is
    // narrower than fetch's overloads — hence the cast at the boundary rather
    // than an `any` mock that would lose the typing inside every assertion.
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('posts all tokens in one request, with the dedupe key as collapseId', async () => {
    fetchMock.mockResolvedValue(ok([{ status: 'ok' }, { status: 'ok' }]));

    await expect(transport.send(push)).resolves.toEqual({ invalidTokens: [] });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sent().url).toBe('https://exp.host/--/api/v2/push/send');
    expect(sent().body).toMatchObject({
      to: ['tok-a', 'tok-b'],
      title: 'Dana mentioned you',
      body: 'can you check the mix?',
      collapseId: 'mention:c1:u1',
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
    expect(sent(0).body.to).toHaveLength(100);
    expect(sent(1).body.to).toHaveLength(50);
  });

  it('omits the Authorization header when no access token is configured', async () => {
    fetchMock.mockResolvedValue(ok([]));
    await transport.send(push);
    expect(sent().headers).not.toHaveProperty('Authorization');

    fetchMock.mockResolvedValue(ok([]));
    await new ExpoPushTransport('secret-tok').send(push);
    expect(sent(1).headers).toMatchObject({
      Authorization: 'Bearer secret-tok',
    });
  });

  // A 200 carrying a top-level `errors` array is a rejected request, not a
  // clean send. Treated as success it would stamp the row SENT and lose the
  // notification with no retry and no log.
  it('throws when a 200 carries a top-level errors array', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS' }],
        }),
    });

    await expect(transport.send(push)).rejects.toThrow(
      /PUSH_TOO_MANY_EXPERIENCE_IDS/,
    );
  });

  it('throws when a 200 carries no ticket array at all', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await expect(transport.send(push)).rejects.toThrow(/no ticket array/);
  });

  /**
   * Position is only meaningful when the counts line up. A short array with a
   * positional fallback would blame the wrong device — deleting a live token
   * and keeping the dead one.
   */
  it('does not guess a token when the ticket count does not match', async () => {
    fetchMock.mockResolvedValue(
      ok([{ status: 'error', details: { error: 'DeviceNotRegistered' } }]),
    );

    await expect(transport.send(push)).resolves.toEqual({ invalidTokens: [] });
  });

  // An echoed token is authoritative even when the counts disagree.
  it('still trusts an echoed token when counts do not match', async () => {
    fetchMock.mockResolvedValue(
      ok([
        {
          status: 'error',
          details: { error: 'DeviceNotRegistered', expoPushToken: 'tok-b' },
        },
      ]),
    );

    await expect(transport.send(push)).resolves.toEqual({
      invalidTokens: ['tok-b'],
    });
  });
});
