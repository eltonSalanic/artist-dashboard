import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { StorageService } from '../attachments/storage.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('TasksService', () => {
  const prisma = {
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    taskStatus: { findFirst: jest.fn() },
    membership: { findMany: jest.fn() },
    checklistItem: { aggregate: jest.fn(), create: jest.fn() },
    attachment: { findMany: jest.fn().mockResolvedValue([]) },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ displayName: 'sam' }),
    },
    taskAssignee: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    emailDelivery: { createMany: jest.fn() },
    activity: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  // Transactions run against the same mock, so assertions on `prisma.<model>`
  // still see writes made inside one.
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const storage = { remove: jest.fn() };
  const service = new TasksService(
    prisma as unknown as PrismaService,
    new ActivityService(prisma as unknown as PrismaService),
    storage as unknown as StorageService,
    new NotificationsService(prisma as unknown as PrismaService),
  );

  const baseTask = {
    id: 't1',
    boardId: 'b1',
    parentTaskId: null,
    sortOrder: 1024,
    statusId: 's1',
    title: 'T',
    status: { id: 's1', name: 'Not Started', color: '#888888', isDone: false },
  };

  beforeEach(() => jest.clearAllMocks());

  describe('setAssignees notifications', () => {
    const assignedAt = new Date('2026-08-01T12:00:00Z');

    /** A task currently assigned to `u2`, plus the mocks setAssignees needs. */
    const withCurrentAssignee = () => {
      prisma.task.findFirst.mockResolvedValue({
        ...baseTask,
        dueDate: null,
        assignees: [
          {
            userId: 'u2',
            createdAt: assignedAt,
            user: { id: 'u2', displayName: 'Ringo' },
          },
        ],
      });
      prisma.task.findUniqueOrThrow.mockResolvedValue({
        ...baseTask,
        archivedAt: null,
        dueDate: null,
        assignees: [],
        goal: null,
        event: null,
        createdBy: { id: 'u1', displayName: 'Elton' },
        subtasks: [],
        _count: { checklist: 0 },
      });
    };

    /** Rows the outbox was asked to write on the last call. */
    const queued = (): {
      userId: string;
      template: string;
      dedupeKey: string;
    }[] => {
      const calls = prisma.emailDelivery.createMany.mock.calls as [
        { data: { userId: string; template: string; dedupeKey: string }[] },
      ][];
      return calls.length ? calls[calls.length - 1][0].data : [];
    };

    it('queues an assignment email keyed on the new assignment row', async () => {
      withCurrentAssignee();
      prisma.membership.findMany.mockResolvedValue([
        { userId: 'u2' },
        { userId: 'u3' },
      ]);
      const addedAt = new Date('2026-08-02T09:30:00Z');
      prisma.taskAssignee.findMany.mockResolvedValue([
        { userId: 'u3', createdAt: addedAt },
      ]);

      await service.setAssignees('b1', 't1', 'u1', {
        assigneeIds: ['u2', 'u3'],
      });

      expect(queued()).toEqual([
        expect.objectContaining({
          userId: 'u3',
          template: 'task-assigned',
          dedupeKey: `assign:t1:u3:${addedAt.getTime()}`,
        }),
      ]);
    });

    it('queues an unassignment email keyed on the assignment that ended', async () => {
      withCurrentAssignee();
      prisma.membership.findMany.mockResolvedValue([]);
      prisma.taskAssignee.findMany.mockResolvedValue([]);

      await service.setAssignees('b1', 't1', 'u1', { assigneeIds: [] });

      expect(queued()).toEqual([
        expect.objectContaining({
          userId: 'u2',
          template: 'task-unassigned',
          dedupeKey: `unassign:t1:u2:${assignedAt.getTime()}`,
        }),
      ]);
    });

    it('never emails you about your own assignment', async () => {
      withCurrentAssignee();
      prisma.membership.findMany.mockResolvedValue([
        { userId: 'u2' },
        { userId: 'u1' },
      ]);
      prisma.taskAssignee.findMany.mockResolvedValue([
        { userId: 'u1', createdAt: new Date() },
      ]);

      // u1 assigns the task to themselves.
      await service.setAssignees('b1', 't1', 'u1', {
        assigneeIds: ['u2', 'u1'],
      });

      expect(prisma.emailDelivery.createMany).not.toHaveBeenCalled();
    });

    it('queues nothing when the assignee set is unchanged', async () => {
      withCurrentAssignee();
      prisma.membership.findMany.mockResolvedValue([{ userId: 'u2' }]);
      prisma.taskAssignee.findMany.mockResolvedValue([]);

      await service.setAssignees('b1', 't1', 'u1', { assigneeIds: ['u2'] });

      expect(prisma.emailDelivery.createMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne subtask visibility', () => {
    /** A task row shaped enough for `toDto`, with the given subtasks. */
    const withSubtasks = (
      archivedAt: Date | null,
      subtasks: { id: string; archivedAt: Date | null }[],
    ) => ({
      ...baseTask,
      archivedAt,
      assignees: [],
      goal: null,
      event: null,
      createdBy: { id: 'u1', displayName: 'Elton' },
      _count: { checklist: 0 },
      subtasks: subtasks.map((s) => ({
        ...baseTask,
        ...s,
        assignees: [],
        goal: null,
        event: null,
        subtasks: [],
        _count: { checklist: 0 },
      })),
    });

    it('hides a subtask archived on its own from a live parent', async () => {
      prisma.task.findFirst.mockResolvedValue(
        withSubtasks(null, [
          { id: 'live', archivedAt: null },
          { id: 'gone', archivedAt: new Date() },
        ]),
      );

      const task = await service.findOne('b1', 't1');

      expect(task.subtasks.map((s) => s.id)).toEqual(['live']);
      expect(task.subtaskCount).toBe(1);
    });

    it('keeps the whole subtree on an archived parent — the only way back to it', async () => {
      prisma.task.findFirst.mockResolvedValue(
        withSubtasks(new Date(), [
          { id: 'a', archivedAt: new Date() },
          { id: 'b', archivedAt: new Date() },
        ]),
      );

      const task = await service.findOne('b1', 't1');

      expect(task.subtasks.map((s) => s.id)).toEqual(['a', 'b']);
      expect(task.subtaskCount).toBe(2);
    });
  });

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
        status: {
          id: 's1',
          name: 'Not Started',
          color: '#888888',
          isDone: false,
        },
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
      prisma.task.findFirst.mockResolvedValue({
        ...baseTask,
        assignees: [{ userId: 'u1' }],
      });
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

      const result = await service.update('b1', 't1', 'u1', 'USER', {
        statusId: 's2',
      });
      expect(result.statusId).toBe('s2');
    });

    it('blocks USER from restatusing a task they are not assigned to', async () => {
      prisma.task.findFirst.mockResolvedValue({ ...baseTask, assignees: [] });
      await expect(
        service.update('b1', 't1', 'u1', 'USER', { statusId: 's2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('lets ADMIN restatus a task they are not assigned to', async () => {
      prisma.task.findFirst
        .mockResolvedValueOnce({ ...baseTask, assignees: [] })
        .mockResolvedValueOnce({ id: 's2' });
      prisma.taskStatus.findFirst.mockResolvedValue({ id: 's2' });
      prisma.task.update.mockResolvedValue({
        ...baseTask,
        statusId: 's2',
        status: { id: 's2', name: 'Done', color: '#22cc88', isDone: true },
        assignees: [],
        checklist: [],
        _count: { subtasks: 0, checklist: 0 },
      });

      const result = await service.update('b1', 't1', 'admin', 'ADMIN', {
        statusId: 's2',
      });
      expect(result.statusId).toBe('s2');
    });

    it('blocks USER from editing the title', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);
      await expect(
        service.update('b1', 't1', 'u1', 'USER', {
          title: 'Renamed',
          statusId: 's2',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('rejects a status from another board', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);
      prisma.taskStatus.findFirst.mockResolvedValue(null);
      await expect(
        service.update('b1', 't1', 'u1', 'ADMIN', { statusId: 'foreign' }),
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

      const result = await service.reorder('b1', 't1', {
        afterTaskId: 'after',
      });
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
        service.setAssignees('b1', 't1', 'u1', {
          assigneeIds: ['u1', 'stranger'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
