import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { StorageService } from './storage.service';

describe('AttachmentsService', () => {
  const prisma = {
    attachment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    task: { findFirst: jest.fn() },
    comment: { findFirst: jest.fn() },
    activity: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const storage = {
    createUploadUrl: jest.fn(),
    createDownloadUrl: jest.fn(),
    createViewUrl: jest.fn(),
    remove: jest.fn(),
  };
  const service = new AttachmentsService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
    new ActivityService(prisma as unknown as PrismaService),
  );

  const dto = {
    storagePath: 'b1/abc/mix.wav',
    fileName: 'mix.wav',
    mimeType: 'audio/wav',
    size: 1024,
    taskId: 't1',
  };
  const stored = {
    id: 'a1',
    fileName: 'mix.wav',
    mimeType: 'audio/wav',
    size: 1024,
    taskId: 't1',
    commentId: null,
    createdAt: new Date(),
    uploadedBy: { id: 'u1', displayName: 'sam' },
  };

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('records the row and logs FILE_UPLOADED together', async () => {
      prisma.task.findFirst.mockResolvedValue({ title: 'Mix' });
      prisma.attachment.create.mockResolvedValue(stored);

      const result = await service.create('b1', 'u1', dto);

      expect(result.fileName).toBe('mix.wav');
      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'FILE_UPLOADED' }),
        }),
      );
    });

    it("rejects a path pointing at another board's prefix", async () => {
      await expect(
        service.create('b1', 'u1', { ...dto, storagePath: 'b2/abc/mix.wav' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('404s when the parent task is not on this board', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.create('b1', 'u1', dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the row and the object for the uploader', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'a1',
        uploadedById: 'u1',
        storagePath: 'b1/abc/mix.wav',
      });

      await service.remove('b1', 'a1', 'u1', 'USER');

      expect(prisma.attachment.delete).toHaveBeenCalled();
      expect(storage.remove).toHaveBeenCalledWith(['b1/abc/mix.wav']);
    });

    it("blocks a member from deleting someone else's upload", async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'a1',
        uploadedById: 'u2',
        storagePath: 'b1/abc/mix.wav',
      });

      await expect(
        service.remove('b1', 'a1', 'u1', 'USER'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('lets an admin delete any upload', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'a1',
        uploadedById: 'u2',
        storagePath: 'b1/abc/mix.wav',
      });

      await expect(service.remove('b1', 'a1', 'u1', 'ADMIN')).resolves.toEqual({
        deleted: true,
      });
    });
  });

  describe('viewUrl', () => {
    it('signs an inline URL and echoes the stored mime type', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'a1',
        storagePath: 'b1/abc/mix.wav',
        fileName: 'mix.wav',
        mimeType: 'audio/wav',
      });
      storage.createViewUrl.mockResolvedValue({
        url: 'https://signed/inline',
        expiresIn: 60,
      });

      const result = await service.viewUrl('b1', 'a1');

      expect(storage.createViewUrl).toHaveBeenCalledWith('b1/abc/mix.wav');
      expect(result).toEqual({
        url: 'https://signed/inline',
        expiresIn: 60,
        mimeType: 'audio/wav',
      });
    });

    it('404s for an attachment on another board', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);
      await expect(service.viewUrl('b1', 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  it('refuses to list without a parent to scope to', async () => {
    await expect(service.list('b1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
