import type { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { R2ObjectStorage } from './r2-object-storage';

const env: Record<string, string> = {
  R2_ACCOUNT_ID: 'acct123',
  R2_ACCESS_KEY_ID: 'AKIDEXAMPLE',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'bandwall-attachments-test',
};
const config = {
  getOrThrow: (key: string) => env[key],
} as unknown as ConfigService;

describe('R2ObjectStorage', () => {
  // A real client, so the presigner signs real URLs; nothing goes over the wire.
  const real = new R2ObjectStorage(config);

  it('signs an upload on the account endpoint with the size in the signature', async () => {
    const upload = await real.createUploadUrl('b1/u1/mix.wav', {
      contentType: 'audio/wav',
      size: 1234,
    });
    const url = new URL(upload.url);
    expect(url.host).toBe(
      'bandwall-attachments-test.acct123.r2.cloudflarestorage.com',
    );
    expect(url.pathname).toBe('/b1/u1/mix.wav');
    const signed = url.searchParams.get('X-Amz-SignedHeaders') ?? '';
    expect(signed).toContain('content-length');
    expect(signed).toContain('content-type');
    expect(upload.headers['Content-Type']).toBe('audio/wav');
    expect(upload.headers['Cache-Control']).toContain('immutable');
  });

  it('signs a download that saves under the file name', async () => {
    const { url, expiresIn } = await real.createDownloadUrl(
      'b1/u1/x',
      'Rider v2.pdf',
    );
    const disposition = new URL(url).searchParams.get(
      'response-content-disposition',
    );
    expect(disposition).toContain('attachment; filename="Rider v2.pdf"');
    expect(expiresIn).toBe(60);
  });

  describe('with a stubbed client', () => {
    const send = jest.fn<Promise<unknown>, [unknown]>();
    const storage = new R2ObjectStorage(config, {
      send,
    } as unknown as S3Client);

    beforeEach(() => send.mockReset());

    it('head returns the real size and type', async () => {
      send.mockResolvedValue({ ContentLength: 42, ContentType: 'image/webp' });
      await expect(storage.head('k')).resolves.toEqual({
        size: 42,
        contentType: 'image/webp',
      });
      expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    });

    it('head returns null for a missing object', async () => {
      send.mockRejectedValue(new NotFound({ message: 'nope', $metadata: {} }));
      await expect(storage.head('k')).resolves.toBeNull();
    });

    it('head rethrows other failures', async () => {
      send.mockRejectedValue(new Error('network down'));
      await expect(storage.head('k')).rejects.toThrow('network down');
    });

    it('removes a batch in one request and never throws', async () => {
      send.mockResolvedValue({ Errors: [{ Key: 'a' }] });
      await storage.remove(['a', 'b']);
      const command = send.mock.calls[0][0] as DeleteObjectsCommand;
      expect(command).toBeInstanceOf(DeleteObjectsCommand);
      expect(command.input.Delete?.Objects).toEqual([
        { Key: 'a' },
        { Key: 'b' },
      ]);

      send.mockRejectedValue(new Error('boom'));
      await expect(storage.remove(['a'])).resolves.toBeUndefined();
    });

    it('does nothing for an empty list', async () => {
      await storage.remove([]);
      expect(send).not.toHaveBeenCalled();
    });
  });
});
