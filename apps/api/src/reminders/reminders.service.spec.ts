import { NotFoundException } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RemindersService', () => {
  const prisma = {
    reminder: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const service = new RemindersService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('sorts undated notes after the dated reminders', async () => {
    prisma.reminder.findMany.mockResolvedValue([]);

    await service.list('b1');

    expect(prisma.reminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { done: 'asc' },
          { remindAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
      }),
    );
  });

  it('will not fetch a reminder from another board', async () => {
    prisma.reminder.findFirst.mockResolvedValue(null);

    await expect(service.findOne('b1', 'r-elsewhere')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.reminder.findFirst).toHaveBeenCalledWith({
      where: { id: 'r-elsewhere', boardId: 'b1' },
    });
  });

  it('creates a reminder with no time when none is given', async () => {
    prisma.reminder.create.mockResolvedValue({});

    await service.create('b1', { title: 'Rehearsal might be cancelled' });

    expect(prisma.reminder.create).toHaveBeenCalledWith({
      data: {
        boardId: 'b1',
        title: 'Rehearsal might be cancelled',
        description: null,
        remindAt: null,
      },
    });
  });

  it('keeps the time when one is given', async () => {
    prisma.reminder.create.mockResolvedValue({});

    await service.create('b1', {
      title: 'Load in',
      remindAt: '2026-03-10T18:00:00.000Z',
    });

    expect(prisma.reminder.create).toHaveBeenCalledWith({
      data: {
        boardId: 'b1',
        title: 'Load in',
        description: null,
        remindAt: '2026-03-10T18:00:00.000Z',
      },
    });
  });
});
