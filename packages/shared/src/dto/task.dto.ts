import { z } from 'zod';
import { Priorities } from '../enums';

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).optional(),
  priority: z.enum(Priorities).default('MEDIUM'),
  statusId: z.uuid().optional(),
  dueDate: z.iso.datetime().nullish(),
  parentTaskId: z.uuid().optional(),
  goalId: z.uuid().nullish(),
  eventId: z.uuid().nullish(),
  assigneeIds: z.array(z.uuid()).max(20).default([]),
});
export type CreateTaskDto = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).nullable(),
    priority: z.enum(Priorities),
    statusId: z.uuid(),
    dueDate: z.iso.datetime().nullable(),
    goalId: z.uuid().nullable(),
    eventId: z.uuid().nullable(),
  })
  .partial();
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;

export const taskQuerySchema = z.object({
  search: z.string().max(200).optional(),
  statusId: z.uuid().optional(),
  assigneeId: z.uuid().optional(),
  priority: z.enum(Priorities).optional(),
  goalId: z.uuid().optional(),
  eventId: z.uuid().optional(),
  sort: z.enum(['order', 'dueDate', 'priority', 'createdAt']).default('order'),
  /**
   * Include archived tasks. Used when listing the tasks of a goal or event
   * that is itself archived — there, the archived ones are the point.
   */
  includeArchived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type TaskQueryDto = z.infer<typeof taskQuerySchema>;

export const reorderTaskSchema = z.object({
  /** Place the task directly after this sibling; null moves it to the top. */
  afterTaskId: z.uuid().nullable(),
});
export type ReorderTaskDto = z.infer<typeof reorderTaskSchema>;

export const setAssigneesSchema = z.object({
  assigneeIds: z.array(z.uuid()).max(20),
});
export type SetAssigneesDto = z.infer<typeof setAssigneesSchema>;

export const createChecklistItemSchema = z.object({
  text: z.string().trim().min(1).max(500),
});
export type CreateChecklistItemDto = z.infer<typeof createChecklistItemSchema>;

export const updateChecklistItemSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    done: z.boolean(),
  })
  .partial();
export type UpdateChecklistItemDto = z.infer<typeof updateChecklistItemSchema>;
