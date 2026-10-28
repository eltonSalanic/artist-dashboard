import {
  ApiError,
  NetworkError,
  apiFetch,
  configureApiClient,
  notify,
  resetApiClient,
} from './client';

describe('api client', () => {
  const fetchMock = jest.fn();
  const getAccessToken = jest.fn<Promise<string | null>, []>();
  const error = jest.fn();
  const success = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    resetApiClient();
    global.fetch = fetchMock as unknown as typeof fetch;
    getAccessToken.mockResolvedValue('tok');
    configureApiClient({
      baseUrl: 'https://api.test',
      getAccessToken,
      notify: { error, success },
    });
  });

  const ok = (body: unknown) => ({ ok: true, json: async () => body });

  it('prefixes the configured baseUrl', async () => {
    fetchMock.mockResolvedValue(ok({ id: 1 }));
    await expect(apiFetch('/tasks')).resolves.toEqual({ id: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/tasks');
  });

  it('sends the injected token as a bearer header', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await apiFetch('/me');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer tok',
    });
  });

  it('omits the header entirely when signed out', async () => {
    getAccessToken.mockResolvedValue(null);
    fetchMock.mockResolvedValue(ok({}));
    await apiFetch('/me');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      'Authorization',
    );
  });

  // A body means JSON; no body must not send a Content-Type, which would make
  // some servers reject an otherwise empty POST.
  it('only sets Content-Type when there is a body', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await apiFetch('/tasks', { method: 'POST', body: { title: 'x' } });
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'Content-Type': 'application/json',
    });
    expect(fetchMock.mock.calls[0][1].body).toBe('{"title":"x"}');

    fetchMock.mockResolvedValue(ok({}));
    await apiFetch('/ping', { method: 'POST' });
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty(
      'Content-Type',
    );
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
  });

  it('throws ApiError carrying the status and the server message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'Title is required' }),
    });
    await expect(apiFetch('/tasks')).rejects.toMatchObject({
      status: 400,
      message: 'Title is required',
    } satisfies Partial<ApiError>);
  });

  it('falls back to statusText when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 504,
      statusText: 'Gateway Timeout',
      json: async () => {
        throw new Error('not json');
      },
    });
    await expect(apiFetch('/tasks')).rejects.toMatchObject({
      message: 'Gateway Timeout',
    });
  });

  it('keeps validation issues, code and request id from the body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: '',
      json: async () => ({
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        requestId: 'req-1',
        issues: [{ path: 'title', message: 'Required' }, { bogus: true }],
      }),
    });
    const error = await apiFetch('/tasks').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).issues).toEqual([
      { path: 'title', message: 'Required' },
    ]);
    expect((error as ApiError).code).toBe('VALIDATION_FAILED');
    expect((error as ApiError).requestId).toBe('req-1');
  });

  // HTTP/2 and React Native leave statusText empty.
  it('never produces an empty message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: '',
      json: async () => {
        throw new Error('html');
      },
    });
    await expect(apiFetch('/tasks')).rejects.toMatchObject({
      message: 'Request failed (502)',
    });
  });

  it('wraps a failed fetch in NetworkError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiFetch('/tasks')).rejects.toBeInstanceOf(NetworkError);
  });

  it('lets an abort through untouched', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValue(abort);
    await expect(apiFetch('/tasks')).rejects.toBe(abort);
  });

  it('calls onUnauthorized on a 401 for a signed-in request', async () => {
    const onUnauthorized = jest.fn();
    configureApiClient({
      baseUrl: 'https://api.test',
      getAccessToken,
      notify: { error, success },
      onUnauthorized,
    });
    const unauthorized = {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Unauthorized' }),
    };
    fetchMock.mockResolvedValue(unauthorized);
    await expect(apiFetch('/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    // Signed out already: nothing to expire.
    getAccessToken.mockResolvedValue(null);
    await expect(apiFetch('/me')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('routes notifications to the injected notifier', () => {
    notify.error('nope');
    notify.success('yep');
    expect(error).toHaveBeenCalledWith('nope');
    expect(success).toHaveBeenCalledWith('yep');
  });

  // Mobile and web each configure this at startup; an unconfigured call must
  // fail loudly rather than request `undefined/tasks` unauthenticated.
  it('throws when used before configureApiClient', async () => {
    resetApiClient();
    await expect(apiFetch('/tasks')).rejects.toThrow(/configureApiClient/);
    expect(() => notify.error('x')).toThrow(/configureApiClient/);
  });
});
