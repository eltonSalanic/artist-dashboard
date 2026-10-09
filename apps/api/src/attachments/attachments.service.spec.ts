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
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: { findFirst: jest.fn() },
    comment: { findFirst: jest.fn() },
    event: { findFirst: jest.fn() },
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
    eventId: null,
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

    it('attaches to an event and names it in the feed', async () => {
      prisma.event.findFirst.mockResolvedValue({ title: 'The Echo' });
      prisma.attachment.create.mockResolvedValue({
        ...stored,
        taskId: null,
        eventId: 'e1',
      });
      const result = await service.create('b1', 'u1', {
        ...dto,
        taskId: undefined,
        eventId: 'e1',
      });

      expect(result.eventId).toBe('e1');
      expect(prisma.event.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1', boardId: 'b1' } }),
      );
      expect(prisma.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventId: 'e1', taskId: null }),
        }),
      );
      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: expect.objectContaining({
              eventTitle: 'The Echo',
              taskTitle: null,
            }),
          }),
        }),
      );
    });

    it('refuses an event on another board', async () => {
      prisma.event.findFirst.mockResolvedValue(null);
      await expect(
        service.create('b1', 'u1', {
          ...dto,
          taskId: undefined,
          eventId: 'e1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.attachment.create).not.toHaveBeenCalled();
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

  describe('rename', () => {
    const owned = { id: 'a1', boardId: 'b1', uploadedById: 'u1' };

    it('renames your own upload, leaving the stored object alone', async () => {
      prisma.attachment.findFirst.mockResolvedValue(owned);
      prisma.attachment.update.mockResolvedValue({
        ...stored,
        fileName: 'Stage plot.pdf',
      });

      const result = await service.rename('b1', 'a1', 'u1', 'USER', {
        fileName: 'Stage plot.pdf',
      });

      expect(result.fileName).toBe('Stage plot.pdf');
      expect(prisma.attachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'a1' },
          data: { fileName: 'Stage plot.pdf' },
        }),
      );
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it("lets an admin rename someone else's upload", async () => {
      prisma.attachment.findFirst.mockResolvedValue(owned);
      prisma.attachment.update.mockResolvedValue(stored);

      await service.rename('b1', 'a1', 'u2', 'ADMIN', { fileName: 'x.pdf' });

      expect(prisma.attachment.update).toHaveBeenCalled();
    });

    it("refuses a member renaming someone else's upload", async () => {
      prisma.attachment.findFirst.mockResolvedValue(owned);

      await expect(
        service.rename('b1', 'a1', 'u2', 'USER', { fileName: 'x.pdf' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.attachment.update).not.toHaveBeenCalled();
    });
  });
});
