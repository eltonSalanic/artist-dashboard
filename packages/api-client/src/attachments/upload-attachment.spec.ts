import { MAX_ATTACHMENT_BYTES } from '@artist/shared';
import { configureApiClient, resetApiClient } from '../client';
import { uploadAttachment, type UploadSource } from './use-attachments';

describe('uploadAttachment', () => {
  const fetchMock = jest.fn();
  const ok = (body: unknown) => ({ ok: true, json: async () => body });

  beforeEach(() => {
    jest.clearAllMocks();
    resetApiClient();
    global.fetch = fetchMock as unknown as typeof fetch;
    configureApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: async () => 'tok',
      notify: { error: jest.fn(), success: jest.fn() },
    });
  });

  const source = (overrides: Partial<UploadSource> = {}): UploadSource => ({
    fileName: 'mix.wav',
    contentType: 'audio/wav',
    size: 1234,
    put: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  it('signs, puts, then persists — with the path the API minted', async () => {
    fetchMock
      .mockResolvedValueOnce(
        ok({ path: 'b1/uuid/mix.wav', token: 't', signedUrl: 'https://s/up' }),
      )
      .mockResolvedValueOnce(ok({ id: 'a1' }));
    const file = source();

    await expect(
      uploadAttachment('b1', { taskId: 't1' }, file),
    ).resolves.toEqual({ id: 'a1' });

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.test/boards/b1/attachments/upload-url',
    );
    expect(file.put).toHaveBeenCalledWith('https://s/up', 'audio/wav');
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api.test/boards/b1/attachments',
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      storagePath: 'b1/uuid/mix.wav',
      fileName: 'mix.wav',
      mimeType: 'audio/wav',
      size: 1234,
      taskId: 't1',
    });
  });

  // An unknown type must still validate server-side, and must be the same
  // string Storage was told — the row and the object would disagree otherwise.
  it('sends octet-stream when the platform could not tell the type', async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ path: 'b1/u/x', token: 't', signedUrl: 'u' }))
      .mockResolvedValueOnce(ok({ id: 'a1' }));
    const file = source({ contentType: '' });

    await uploadAttachment('b1', { commentId: 'c1' }, file);

    expect(file.put).toHaveBeenCalledWith('u', 'application/octet-stream');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      mimeType: 'application/octet-stream',
      commentId: 'c1',
    });
  });

  it('refuses an oversized file before asking for a URL', async () => {
    const file = source({ size: MAX_ATTACHMENT_BYTES + 1 });
    await expect(uploadAttachment('b1', { taskId: 't1' }, file)).rejects.toThrow(
      '50MB',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(file.put).not.toHaveBeenCalled();
  });

  // A row pointing at an object that never arrived would list a file that
  // 404s on every tap.
  it('persists nothing when Storage rejects the bytes', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({ path: 'b1/u/x', token: 't', signedUrl: 'u' }),
    );
    const file = source({
      put: jest.fn().mockRejectedValue(new Error('Storage rejected')),
    });

    await expect(uploadAttachment('b1', { taskId: 't1' }, file)).rejects.toThrow(
      'Storage rejected',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
