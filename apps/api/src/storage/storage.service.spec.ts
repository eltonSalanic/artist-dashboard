import { BadRequestException } from '@nestjs/common';
import {
  attachmentObjectPaths,
  StorageService,
  thumbnailPathFor,
} from './storage.service';

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

  it('signs a JPEG thumbnail beside the original when asked for one', async () => {
    objects.createUploadUrl.mockImplementation((key: string) =>
      Promise.resolve({ url: `https://signed/${key}`, expiresIn: 900 }),
    );

    const result = await service.createUploadUrl('b1', {
      fileName: 'thumb.jpg',
      contentType: 'image/jpeg',
      size: 1000,
      thumbnail: { size: 40_000 },
    });

    const folder = result.path.slice(0, result.path.lastIndexOf('/'));
    expect(result.thumbnail?.path).toBe(`${folder}/thumb/400.jpg`);
    expect(result.thumbnail?.path).not.toBe(result.path);
    expect(objects.createUploadUrl).toHaveBeenCalledWith(
      result.thumbnail?.path,
      { contentType: 'image/jpeg', size: 40_000 },
    );
  });

  it('asks for no thumbnail URL unless the client made one', async () => {
    objects.createUploadUrl.mockResolvedValue({ url: 'u', expiresIn: 900 });
    const result = await service.createUploadUrl('b1', {
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      size: 10,
    });
    expect(result).not.toHaveProperty('thumbnail');
    expect(objects.createUploadUrl).toHaveBeenCalledTimes(1);
  });

  it('lists originals and thumbnails for removal', () => {
    expect(thumbnailPathFor('b1/x/photo.jpg')).toBe('b1/x/thumb/400.jpg');
    expect(
      attachmentObjectPaths([
        { storagePath: 'b1/x/photo.jpg', thumbnailPath: 'b1/x/thumb/400.jpg' },
        { storagePath: 'b1/y/a.pdf', thumbnailPath: null },
      ]),
    ).toEqual(['b1/x/photo.jpg', 'b1/x/thumb/400.jpg', 'b1/y/a.pdf']);
  });
});
