import { ConflictException } from '@nestjs/common';
import {
  AccountDeletionService,
  FORMER_MEMBER,
} from './account-deletion.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';

const ME = 'u1';
const auth = { userId: ME, email: 'sam@band.com' };

function board(id: string, ownerId: string | null, members: number, name = id) {
  return { id, name, ownerId, _count: { memberships: members } };
}

describe('AccountDeletionService', () => {
  const tx = {
    event: { deleteMany: jest.fn() },
    board: { deleteMany: jest.fn() },
    user: { upsert: jest.fn(), deleteMany: jest.fn() },
    task: { updateMany: jest.fn() },
    comment: { updateMany: jest.fn() },
    attachment: { updateMany: jest.fn() },
    itemLink: { updateMany: jest.fn() },
    invite: { updateMany: jest.fn(), deleteMany: jest.fn() },
    authUser: { deleteMany: jest.fn() },
  };
  const prisma = {
    membership: { findMany: jest.fn() },
    board: { findMany: jest.fn() },
    attachment: { findMany: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<void>) => fn(tx)),
  };
  const storage = { remove: jest.fn() };
  const service = new AccountDeletionService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
  );

  function memberOf(...boards: ReturnType<typeof board>[]) {
    prisma.membership.findMany.mockResolvedValue(
      boards.map((b) => ({ board: b })),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.board.findMany.mockResolvedValue([]);
    prisma.attachment.findMany.mockResolvedValue([]);
    storage.remove.mockResolvedValue(undefined);
  });

  it('refuses while they own a band other people are in, naming it', async () => {
    memberOf(board('b1', ME, 3, 'Neon Harbor'), board('b2', ME, 1, 'Solo'));

    const error = await service.deleteAccount(auth).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      statusCode: 409,
      code: 'OWNS_SHARED_BANDS',
      boards: [{ id: 'b1', name: 'Neon Harbor' }],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('deletes a band only they are in, with its files', async () => {
    memberOf(board('b1', ME, 1));
    prisma.attachment.findMany.mockResolvedValue([
      { storagePath: 'b1/a.pdf', thumbnailPath: null },
      { storagePath: 'b1/p.jpg', thumbnailPath: 'b1/p.thumb.jpg' },
    ]);

    await service.deleteAccount(auth);

    expect(tx.event.deleteMany).toHaveBeenCalledWith({
      where: { boardId: { in: ['b1'] } },
    });
    expect(tx.board.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['b1'] } },
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: ME } });
    expect(tx.authUser.deleteMany).toHaveBeenCalledWith({ where: { id: ME } });
    expect(storage.remove).toHaveBeenCalledWith([
      'b1/a.pdf',
      'b1/p.jpg',
      'b1/p.thumb.jpg',
    ]);
  });

  it('leaves a shared band they only belong to, handing their work to Former member', async () => {
    memberOf(board('b1', 'owner', 4));

    await service.deleteAccount(auth);

    expect(tx.board.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FORMER_MEMBER.id } }),
    );
    for (const [model, field] of [
      [tx.task, 'createdById'],
      [tx.comment, 'authorId'],
      [tx.attachment, 'uploadedById'],
      [tx.itemLink, 'createdById'],
      [tx.invite, 'invitedById'],
    ] as const) {
      expect(model.updateMany).toHaveBeenCalledWith({
        where: { [field]: ME },
        data: { [field]: FORMER_MEMBER.id },
      });
    }
    expect(tx.invite.deleteMany).toHaveBeenCalledWith({
      where: { email: auth.email, status: 'PENDING' },
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({ where: { id: ME } });
    expect(tx.authUser.deleteMany).toHaveBeenCalledWith({ where: { id: ME } });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('keeps a band someone else owns even when they are its last member', async () => {
    memberOf(board('b1', 'owner', 1));

    await service.deleteAccount(auth);

    expect(tx.board.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.deleteMany).toHaveBeenCalled();
  });

  it('still deletes the account when the files fail to go', async () => {
    memberOf(board('b1', ME, 1));
    prisma.attachment.findMany.mockResolvedValue([
      { storagePath: 'b1/a.pdf', thumbnailPath: null },
    ]);
    storage.remove.mockRejectedValue(new Error('R2 down'));

    await expect(service.deleteAccount(auth)).resolves.toBeUndefined();
    expect(tx.authUser.deleteMany).toHaveBeenCalled();
  });
});
