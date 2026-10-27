import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  createItemLinkSchema,
  itemLinkInputSchema,
  LinkParentKinds,
} from '@artist/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LinksService } from './links.service';

const BOARD = '00000000-0000-4000-8000-000000000001';
const PARENT = '00000000-0000-4000-8000-000000000002';

describe('LinksService', () => {
  const prisma = {
    task: { findFirst: jest.fn() },
    event: { findFirst: jest.fn() },
    goal: { findFirst: jest.fn() },
    reminder: { findFirst: jest.fn() },
    itemLink: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new LinksService(prisma as unknown as PrismaService);
  beforeEach(() => jest.resetAllMocks());

  it.each(LinkParentKinds)(
    'lets members attach a link to a %s on their board',
    async (kind) => {
      const model = {
        TASK: prisma.task,
        EVENT: prisma.event,
        GOAL: prisma.goal,
        REMINDER: prisma.reminder,
      }[kind];
      const column = {
        TASK: 'taskId',
        EVENT: 'eventId',
        GOAL: 'goalId',
        REMINDER: 'reminderId',
      }[kind];
      model.findFirst.mockResolvedValue({ id: PARENT });
      const dto = createItemLinkSchema.parse({
        kind,
        parentId: PARENT,
        title: 'Setlist',
        url: 'docs.google.com/spreadsheets/d/123?usp=sharing',
      });
      await service.create(BOARD, 'member', 'USER', dto);
      expect(model.findFirst).toHaveBeenCalledWith({
        where: { id: PARENT, boardId: BOARD },
        select: { id: true },
      });
      expect(prisma.itemLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            boardId: BOARD,
            [column]: PARENT,
            title: 'Setlist',
            url: 'https://docs.google.com/spreadsheets/d/123?usp=sharing',
            createdById: 'member',
          },
        }),
      );
    },
  );

  it('uses the destination hostname when no name is supplied', async () => {
    prisma.task.findFirst.mockResolvedValue({ id: PARENT });
    await service.create(
      BOARD,
      'member',
      'USER',
      createItemLinkSchema.parse({
        kind: 'TASK',
        parentId: PARENT,
        url: 'https://drive.google.com/drive/folders/123',
      }),
    );
    expect(prisma.itemLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'drive.google.com' }),
      }),
    );
  });

  it.each(LinkParentKinds)(
    'rejects a %s belonging to another board when listing and adding',
    async (kind) => {
      const parent = { kind, parentId: PARENT };
      await expect(service.list(BOARD, parent)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.create(BOARD, 'member', 'USER', {
          ...parent,
          title: '',
          url: 'https://example.com',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.itemLink.findMany).not.toHaveBeenCalled();
      expect(prisma.itemLink.create).not.toHaveBeenCalled();
    },
  );

  it('scopes the list to the requested board and parent', async () => {
    prisma.event.findFirst.mockResolvedValue({ id: PARENT });
    await service.list(BOARD, { kind: 'EVENT', parentId: PARENT });
    expect(prisma.itemLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { boardId: BOARD, eventId: PARENT } }),
    );
  });

  it('lets members remove their own links', async () => {
    prisma.itemLink.findFirst.mockResolvedValue({
      id: 'link',
      createdById: 'member',
    });
    await service.remove(BOARD, 'link', 'member', 'USER');
    expect(prisma.itemLink.delete).toHaveBeenCalledWith({
      where: { id: 'link' },
    });
  });

  it('refuses removing another member’s link', async () => {
    prisma.itemLink.findFirst.mockResolvedValue({
      id: 'link',
      createdById: 'someone-else',
    });
    await expect(
      service.remove(BOARD, 'link', 'member', 'USER'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.itemLink.delete).not.toHaveBeenCalled();
  });

  it('lets admins remove anyone’s links', async () => {
    prisma.itemLink.findFirst.mockResolvedValue({
      id: 'link',
      createdById: 'member',
    });
    await service.remove(BOARD, 'link', 'admin', 'ADMIN');
    expect(prisma.itemLink.delete).toHaveBeenCalled();
  });

  it('cannot remove a link on another board', async () => {
    prisma.itemLink.findFirst.mockResolvedValue(null);
    await expect(
      service.remove(BOARD, 'link', 'admin', 'ADMIN'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.itemLink.findFirst).toHaveBeenCalledWith({
      where: { id: 'link', boardId: BOARD },
    });
    expect(prisma.itemLink.delete).not.toHaveBeenCalled();
  });
});

describe('item link input', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///etc/passwd',
    'ftp://example.com',
    'intent://example.com',
    'https://user:password@example.com',
    'not a url',
    '',
  ])('rejects unsafe or invalid address %s', (url) => {
    expect(itemLinkInputSchema.safeParse({ title: '', url }).success).toBe(
      false,
    );
  });

  it('trims names and preserves query parameters and fragments', () => {
    expect(
      itemLinkInputSchema.parse({
        title: '  Band budget  ',
        url: '  https://docs.google.com/spreadsheets/d/123?usp=sharing#gid=12  ',
      }),
    ).toEqual({
      title: 'Band budget',
      url: 'https://docs.google.com/spreadsheets/d/123?usp=sharing#gid=12',
    });
  });

  it('validates the parent and length limits', () => {
    expect(
      createItemLinkSchema.safeParse({
        kind: 'BOARD',
        parentId: PARENT,
        url: 'https://example.com',
      }).success,
    ).toBe(false);
    expect(
      createItemLinkSchema.safeParse({
        kind: 'TASK',
        parentId: 'invalid',
        url: 'https://example.com',
      }).success,
    ).toBe(false);
    expect(
      itemLinkInputSchema.safeParse({
        title: 'x'.repeat(201),
        url: 'https://example.com',
      }).success,
    ).toBe(false);
    expect(
      itemLinkInputSchema.safeParse({
        url: `https://example.com/${'x'.repeat(2048)}`,
      }).success,
    ).toBe(false);
  });
});
