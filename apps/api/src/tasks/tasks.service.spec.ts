import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TasksService', () => {
  const prisma = {
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskStatus: { findFirst: jest.fn() },
    membership: { findMany: jest.fn() },
    checklistItem: { aggregate: jest.fn(), create: jest.fn() },
  };
  const service = new TasksService(prisma as unknown as PrismaService);

  const baseTask = {
    id: 't1',
    boardId: 'b1',
    parentTaskId: null,
    sortOrder: 1024,
  };

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('blocks USER from creating top-level tasks', async () => {
      await expect(
        service.create('b1', 'u1', 'USER', {
          title: 'New song',
          priority: 'MEDIUM',
          assigneeIds: [],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets USER create a subtask of a root task', async () => {
      prisma.task.findFirst.mockResolvedValue({
        ...baseTask,
        parentTask: null,
      });
      prisma.taskStatus.findFirst.mockResolvedValue({ id: 's1' });
      prisma.task.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
      prisma.task.create.mockResolvedValue({
        ...baseTask,
        id: 't2',
        title: 'Subtask',
        description: null,
        priority: 'MEDIUM',
        statusId: 's1',
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: { id: 's1', name: 'Not Started', color: '#888888', isDone: false },
        assignees: [],
        checklist: [],
        _count: { subtasks: 0, checklist: 0 },
      });

      const result = await service.create('b1', 'u1', 'USER', {
        title: 'Subtask',
        priority: 'MEDIUM',
        parentTaskId: 't1',
        assigneeIds: [],
      });
      expect(result.title).toBe('Subtask');
    });

    it('rejects subtasks more than two levels deep', async () => {
      // Parent is itself a subtask whose parent is also a subtask.
      prisma.task.findFirst.mockResolvedValue({
        ...baseTask,
        parentTask: { parentTaskId: 'root' },
      });
      await expect(
        service.create('b1', 'u1', 'ADMIN', {
          title: 'Too deep',
          priority: 'MEDIUM',
          parentTaskId: 't-sub-sub',
          assigneeIds: [],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('lets USER change only statusId', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce(baseTask) // getOwned
        .mockResolvedValueOnce({ id: 's2' }); // (not used) safety
      prisma.taskStatus.findFirst.mockResolvedValue({ id: 's2' });
      prisma.task.update.mockResolvedValue({
        ...baseTask,
        title: 'T',
        description: null,
        priority: 'MEDIUM',
        statusId: 's2',
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: { id: 's2', name: 'Done', color: '#22cc88', isDone: true },
        assignees: [],
        checklist: [],
        _count: { subtasks: 0, checklist: 0 },
      });

      const result = await service.update('b1', 't1', 'USER', {
        statusId: 's2',
      });
      expect(result.statusId).toBe('s2');
    });

    it('blocks USER from editing the title', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);
      await expect(
        service.update('b1', 't1', 'USER', { title: 'Renamed', statusId: 's2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('rejects a status from another board', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);
      prisma.taskStatus.findFirst.mockResolvedValue(null);
      await expect(
        service.update('b1', 't1', 'ADMIN', { statusId: 'foreign' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('reorder', () => {
    it('places the task midway between the target and the next sibling', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce(baseTask) // task
        .mockResolvedValueOnce({ ...baseTask, id: 'after', sortOrder: 2048 }) // after
        .mockResolvedValueOnce({ sortOrder: 3072 }); // next sibling
      prisma.task.update.mockResolvedValue({});

      const result = await service.reorder('b1', 't1', { afterTaskId: 'after' });
      expect(result.sortOrder).toBe(2560);
    });

    it('moves the task to the top when afterTaskId is null', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce(baseTask)
        .mockResolvedValueOnce({ sortOrder: 512 }); // current first sibling
      prisma.task.update.mockResolvedValue({});

      const result = await service.reorder('b1', 't1', { afterTaskId: null });
      expect(result.sortOrder).toBe(512 - 1024);
    });

    it('refuses to reorder across different parents', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce(baseTask)
        .mockResolvedValueOnce({
          ...baseTask,
          id: 'after',
          parentTaskId: 'other-parent',
        });
      await expect(
        service.reorder('b1', 't1', { afterTaskId: 'after' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('setAssignees', () => {
    it('rejects assignees who are not board members', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);
      prisma.membership.findMany.mockResolvedValue([{ userId: 'u1' }]);
      await expect(
        service.setAssignees('b1', 't1', { assigneeIds: ['u1', 'stranger'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
