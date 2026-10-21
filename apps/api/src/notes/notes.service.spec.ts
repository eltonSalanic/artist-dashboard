import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotesService', () => {
  const BOARD = '00000000-0000-4000-8000-000000000001';
  const TASK = '00000000-0000-4000-8000-000000000002';
  const EVENT = '00000000-0000-4000-8000-000000000003';
  const prisma = {
    task: { findFirst: jest.fn() },
    event: { findFirst: jest.fn() },
    goal: { findFirst: jest.fn() },
    reminder: { findFirst: jest.fn() },
    note: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new NotesService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('lists a task’s notes in order, scoped to the board', async () => {
    prisma.task.findFirst.mockResolvedValue({ id: TASK });
    prisma.note.findMany.mockResolvedValue([]);
    await service.list(BOARD, { kind: 'TASK', parentId: TASK });
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TASK, boardId: BOARD } }),
    );
    expect(prisma.note.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { boardId: BOARD, taskId: TASK },
        orderBy: { sortOrder: 'asc' },
      }),
    );
  });

  it('404s when the parent is on another board', async () => {
    prisma.event.findFirst.mockResolvedValue(null);
    await expect(
      service.list(BOARD, { kind: 'EVENT', parentId: EVENT }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('appends a new note after the last one on its parent', async () => {
    prisma.event.findFirst.mockResolvedValue({ id: EVENT });
    prisma.note.aggregate.mockResolvedValue({ _max: { sortOrder: 2000 } });
    await service.create(BOARD, 'ADMIN', {
      kind: 'EVENT',
      parentId: EVENT,
      title: 'Load-in',
      body: '5pm side door',
    });
    expect(prisma.note.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          boardId: BOARD,
          eventId: EVENT,
          title: 'Load-in',
          body: '5pm side door',
          sortOrder: 3000,
        },
      }),
    );
  });

  it('refuses members, who cannot edit the item itself', async () => {
    await expect(
      service.create(BOARD, 'USER', {
        kind: 'TASK',
        parentId: TASK,
        title: 'x',
        body: '',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it('checks the note’s own parent kind on update and delete', async () => {
    prisma.note.findFirst.mockResolvedValue({
      id: 'n1',
      taskId: null,
      eventId: null,
      goalId: 'g1',
    });
    await expect(
      service.update(BOARD, 'n1', 'USER', { title: 'y' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.remove(BOARD, 'n1', 'ADMIN');
    expect(prisma.note.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
  });

  it('404s on a note from another board', async () => {
    prisma.note.findFirst.mockResolvedValue(null);
    await expect(service.remove(BOARD, 'n1', 'ADMIN')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
