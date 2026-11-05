import { BadRequestException } from '@nestjs/common';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  const objects = {
    createUploadUrl: jest.fn(),
    createDownloadUrl: jest.fn(),
    createViewUrl: jest.fn(),
    head: jest.fn(),
    remove: jest.fn(),
  };
  const service = new StorageService(objects);

  beforeEach(() => jest.clearAllMocks());

  it('mints the key under the board and passes type and size to the provider', async () => {
    objects.createUploadUrl.mockResolvedValue({
      url: 'https://signed',
      expiresIn: 900,
      headers: { 'Content-Type': 'audio/wav' },
    });

    const result = await service.createUploadUrl('b1', {
      fileName: 'Final mix (v2).wav',
      contentType: 'audio/wav',
      size: 1000,
    });

    expect(result.path).toMatch(/^b1\/[0-9a-f-]{36}\/Final_mix_v2_.wav$/);
    expect(objects.createUploadUrl).toHaveBeenCalledWith(result.path, {
      contentType: 'audio/wav',
      size: 1000,
    });
    expect(result).toMatchObject({
      signedUrl: 'https://signed',
      headers: { 'Content-Type': 'audio/wav' },
    });
  });

  it('refuses a file over its type cap before asking the provider', async () => {
    await expect(
      service.createUploadUrl('b1', {
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 11 * 1024 * 1024,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(objects.createUploadUrl).not.toHaveBeenCalled();
  });

  it('passes stat and remove through', async () => {
    objects.head.mockResolvedValue(null);
    await expect(service.stat('b1/x')).resolves.toBeNull();
    await service.remove(['b1/x']);
    expect(objects.remove).toHaveBeenCalledWith(['b1/x']);
  });
});
