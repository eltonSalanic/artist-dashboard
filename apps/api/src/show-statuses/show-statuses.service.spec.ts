import { ShowStatusesService } from './show-statuses.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ShowStatusesService', () => {
  const prisma = {
    showStatus: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    event: { count: jest.fn() },
  };
  const service = new ShowStatusesService(prisma as unknown as PrismaService);

  const hold = { id: 's1', boardId: 'b1', category: 'HOLD' };
  const cancelled = { id: 's4', boardId: 'b1', category: 'CANCELLED' };

  beforeEach(() => jest.clearAllMocks());

  it('adds a new status at the end', async () => {
    prisma.showStatus.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
    await service.create('b1', {
      name: 'Advanced',
      color: '#4f7cff',
      category: 'BOOKED',
    });
    expect(prisma.showStatus.create).toHaveBeenCalledWith({
      data: {
        boardId: 'b1',
        name: 'Advanced',
        color: '#4f7cff',
        category: 'BOOKED',
        sortOrder: 4,
      },
    });
  });

  it('refuses to delete a status shows still use', async () => {
    prisma.showStatus.findFirst.mockResolvedValue(hold);
    prisma.event.count.mockResolvedValue(3);
    await expect(service.remove('b1', 's1')).rejects.toThrow(
      '3 show(s) still use this status',
    );
    expect(prisma.showStatus.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete the last status a new show could start in', async () => {
    prisma.showStatus.findFirst.mockResolvedValue(hold);
    prisma.event.count.mockResolvedValue(0);
    prisma.showStatus.count.mockResolvedValue(0);
    await expect(service.remove('b1', 's1')).rejects.toThrow(
      'not a cancellation',
    );
  });

  it('lets a cancelled status go even when it is the only one', async () => {
    prisma.showStatus.findFirst.mockResolvedValue(cancelled);
    prisma.event.count.mockResolvedValue(0);
    await service.remove('b1', 's4');
    expect(prisma.showStatus.count).not.toHaveBeenCalled();
    expect(prisma.showStatus.delete).toHaveBeenCalledWith({ where: { id: 's4' } });
  });

  it('refuses to turn the last startable status into a cancellation', async () => {
    prisma.showStatus.findFirst.mockResolvedValue(hold);
    prisma.showStatus.count.mockResolvedValue(0);
    await expect(
      service.update('b1', 's1', { category: 'CANCELLED' }),
    ).rejects.toThrow('not a cancellation');
  });

  it("won't touch another board's status", async () => {
    prisma.showStatus.findFirst.mockResolvedValue(null);
    await expect(service.update('b2', 's1', { name: 'x' })).rejects.toThrow(
      'Show status not found',
    );
  });
});
