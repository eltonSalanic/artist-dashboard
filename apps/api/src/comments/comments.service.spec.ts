import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { StorageService } from '../attachments/storage.service';

describe('CommentsService', () => {
  const prisma = {
    comment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: { findFirst: jest.fn() },
    membership: { findMany: jest.fn() },
    attachment: { findMany: jest.fn().mockResolvedValue([]) },
    activity: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const storage = { remove: jest.fn() };
  const service = new CommentsService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
    storage as unknown as StorageService,
  );

  const stored = {
    id: 'c1',
    taskId: 't1',
    body: 'Sounds great',
    mentions: [],
    editedAt: null,
    createdAt: new Date(),
    author: { id: 'u1', displayName: 'sam', avatarUrl: null },
    attachments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.attachment.findMany.mockResolvedValue([]);
  });

  describe('create', () => {
    it('logs COMMENT_ADDED in the same transaction as the write', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 't1', title: 'Mix' });
      prisma.comment.create.mockResolvedValue(stored);

      await service.create('b1', 't1', 'u1', {
        body: 'Sounds great',
        mentions: [],
      });

      expect(prisma.activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'COMMENT_ADDED',
            actorId: 'u1',
          }),
        }),
      );
    });

    it('rejects a mention of someone outside the board', async () => {
      prisma.task.findFirst.mockResolvedValue({ id: 't1', title: 'Mix' });
      prisma.membership.findMany.mockResolvedValue([{ userId: 'u2' }]);

      await expect(
        service.create('b1', 't1', 'u1', {
          body: 'hey @stranger',
          mentions: ['u2', 'stranger'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it('404s on a task from another board', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.create('b1', 'foreign', 'u1', { body: 'hi', mentions: [] }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('stamps editedAt when the author edits', async () => {
      prisma.comment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'u1' });
      prisma.comment.update.mockResolvedValue(stored);

      await service.update('b1', 'c1', 'u1', { body: 'Actually, louder' });

      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ editedAt: expect.any(Date) }),
        }),
      );
    });

    it("refuses to let anyone rewrite someone else's comment", async () => {
      prisma.comment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'u2' });

      await expect(
        service.update('b1', 'c1', 'u1', { body: 'nope' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.comment.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lets an admin delete a comment they did not write', async () => {
      prisma.comment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'u2' });

      await expect(service.remove('b1', 'c1', 'u1', 'ADMIN')).resolves.toEqual({
        deleted: true,
      });
    });

    it("blocks a member from deleting someone else's comment", async () => {
      prisma.comment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'u2' });

      await expect(
        service.remove('b1', 'c1', 'u1', 'USER'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.comment.delete).not.toHaveBeenCalled();
    });

    it('purges the stored objects that the cascade leaves behind', async () => {
      prisma.comment.findFirst.mockResolvedValue({ id: 'c1', authorId: 'u1' });
      prisma.attachment.findMany.mockResolvedValue([
        { storagePath: 'b1/x/mix.wav' },
      ]);

      await service.remove('b1', 'c1', 'u1', 'USER');

      expect(storage.remove).toHaveBeenCalledWith(['b1/x/mix.wav']);
    });
  });
});
