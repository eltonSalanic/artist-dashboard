import { NotFoundException } from '@nestjs/common';
import {
  DEFAULT_BOARD_LAYOUT,
  type LayoutItem,
  type MobileLayoutItem,
} from '@artist/shared';
import { LayoutsService } from './layouts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LayoutsService', () => {
  const prisma = {
    board: { findUnique: jest.fn(), update: jest.fn() },
    userLayout: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    mobileLayout: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new LayoutsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('throws when the board does not exist', async () => {
    prisma.board.findUnique.mockResolvedValue(null);
    await expect(service.getForUser('b1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("returns the board default when the user hasn't saved one", async () => {
    prisma.board.findUnique.mockResolvedValue({
      defaultLayout: [{ widgetType: 'TODOS', x: 0, y: 0, w: 8, h: 6 }],
    });
    prisma.userLayout.findUnique.mockResolvedValue(null);

    const result = await service.getForUser('b1', 'u1');
    expect(result.layout).toContainEqual({
      widgetType: 'TODOS',
      x: 0,
      y: 0,
      w: 8,
      h: 6,
    });
  });

  it("merges the user's saved layout over the board default", async () => {
    prisma.board.findUnique.mockResolvedValue({
      defaultLayout: [{ widgetType: 'TODOS', x: 0, y: 0, w: 8, h: 6 }],
    });
    prisma.userLayout.findUnique.mockResolvedValue({
      layout: [{ widgetType: 'TODOS', x: 4, y: 2, w: 4, h: 3 }],
    });

    const result = await service.getForUser('b1', 'u1');
    expect(result.layout).toContainEqual({
      widgetType: 'TODOS',
      x: 4,
      y: 2,
      w: 4,
      h: 3,
    });
  });

  it('serves widgets shipped after the board stored its default', async () => {
    prisma.board.findUnique.mockResolvedValue({
      defaultLayout: [{ widgetType: 'TODOS', x: 0, y: 0, w: 8, h: 6 }],
    });
    prisma.userLayout.findUnique.mockResolvedValue({
      layout: [{ widgetType: 'TODOS', x: 0, y: 0, w: 8, h: 6 }],
    });

    const result = await service.getForUser('b1', 'u1');
    expect(result.layout.map((i) => i.widgetType)).toEqual(
      DEFAULT_BOARD_LAYOUT.map((i) => i.widgetType),
    );
  });

  it('upserts the layout for the current user', async () => {
    const layout: LayoutItem[] = [
      { widgetType: 'MY_TASKS', x: 0, y: 0, w: 4, h: 4 },
    ];
    await service.saveForUser('b1', 'u1', { layout });
    expect(prisma.userLayout.upsert).toHaveBeenCalledWith({
      where: { boardId_userId: { boardId: 'b1', userId: 'u1' } },
      create: { boardId: 'b1', userId: 'u1', layout },
      update: { layout },
    });
  });

  it("updates the board's default layout", async () => {
    const layout: LayoutItem[] = [
      { widgetType: 'TODOS', x: 0, y: 0, w: 8, h: 6 },
    ];
    await service.saveDefault('b1', { layout });
    expect(prisma.board.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { defaultLayout: layout },
    });
  });

  it("clears the user's layout and returns the board default", async () => {
    prisma.userLayout.deleteMany.mockResolvedValue({ count: 1 });
    prisma.board.findUnique.mockResolvedValue({
      defaultLayout: [{ widgetType: 'TODOS', x: 0, y: 0, w: 8, h: 6 }],
    });
    prisma.userLayout.findUnique.mockResolvedValue(null);

    const result = await service.resetForUser('b1', 'u1');

    expect(prisma.userLayout.deleteMany).toHaveBeenCalledWith({
      where: { boardId: 'b1', userId: 'u1' },
    });
    expect(result.layout).toContainEqual({
      widgetType: 'TODOS',
      x: 0,
      y: 0,
      w: 8,
      h: 6,
    });
  });

  it("leaves the phone's arrangement alone when the web layout is reset", async () => {
    prisma.board.findUnique.mockResolvedValue({ defaultLayout: [] });
    prisma.userLayout.findUnique.mockResolvedValue(null);
    await service.resetForUser('b1', 'u1');
    expect(prisma.mobileLayout.deleteMany).not.toHaveBeenCalled();
  });

  describe('the phone arrangement', () => {
    const web: LayoutItem[] = [
      { widgetType: 'GOALS', x: 0, y: 4, w: 4, h: 4 },
      { widgetType: 'SHOWS', x: 0, y: 0, w: 4, h: 4 },
      { widgetType: 'FOCUS', x: 4, y: 0, w: 8, h: 3 },
    ];

    beforeEach(() => {
      prisma.board.findUnique.mockResolvedValue({ defaultLayout: web });
      prisma.userLayout.findUnique.mockResolvedValue(null);
    });

    it('follows the web arrangement until one is saved on a phone', async () => {
      prisma.mobileLayout.findUnique.mockResolvedValue(null);

      const result = await service.getMobileForUser('b1', 'u1');

      expect(result.source).toBe('web');
      expect(result.items.slice(0, 3)).toEqual([
        { widgetType: 'SHOWS', w: 1, h: 1 },
        { widgetType: 'FOCUS', w: 2, h: 1 },
        { widgetType: 'GOALS', w: 1, h: 1 },
      ]);
    });

    it('serves the saved arrangement, with widgets added since at the end', async () => {
      const items: MobileLayoutItem[] = [
        { widgetType: 'GOALS', w: 2, h: 2 },
        { widgetType: 'SHOWS', w: 1, h: 1, hidden: true },
      ];
      prisma.mobileLayout.findUnique.mockResolvedValue({ items });

      const result = await service.getMobileForUser('b1', 'u1');

      expect(result.source).toBe('phone');
      expect(result.items.slice(0, 2)).toEqual(items);
      // Shipped widgets the board's default predates still reach the phone.
      expect(result.items.map((i) => i.widgetType)).toEqual(
        expect.arrayContaining(['FOCUS', 'TODOS']),
      );
    });

    it('upserts the arrangement for the current user and returns it', async () => {
      const items: MobileLayoutItem[] = [{ widgetType: 'SHOWS', w: 2, h: 1 }];
      prisma.mobileLayout.findUnique.mockResolvedValue({ items });

      const result = await service.saveMobileForUser('b1', 'u1', { items });

      expect(prisma.mobileLayout.upsert).toHaveBeenCalledWith({
        where: { boardId_userId: { boardId: 'b1', userId: 'u1' } },
        create: { boardId: 'b1', userId: 'u1', items },
        update: { items },
      });
      expect(result.source).toBe('phone');
    });

    it('follows web when the stored arrangement no longer parses', async () => {
      prisma.mobileLayout.findUnique.mockResolvedValue({
        items: [{ widgetType: 'SHOWS', size: 'half' }],
      });

      const result = await service.getMobileForUser('b1', 'u1');

      expect(result.source).toBe('web');
      expect(result.items[0]).toEqual({ widgetType: 'SHOWS', w: 1, h: 1 });
    });

    it('drops the arrangement on reset, so the phone follows web again', async () => {
      prisma.mobileLayout.findUnique.mockResolvedValue(null);

      const result = await service.resetMobileForUser('b1', 'u1');

      expect(prisma.mobileLayout.deleteMany).toHaveBeenCalledWith({
        where: { boardId: 'b1', userId: 'u1' },
      });
      expect(prisma.userLayout.deleteMany).not.toHaveBeenCalled();
      expect(result.source).toBe('web');
    });
  });
});
