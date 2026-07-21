import { z } from 'zod';
import { GoalPeriods } from '../enums';

export const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000).optional(),
  period: z.enum(GoalPeriods).default('MONTHLY'),
  dueDate: z.iso.datetime().nullish(),
});
export type CreateGoalDto = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).nullable(),
    period: z.enum(GoalPeriods),
    dueDate: z.iso.datetime().nullable(),
    completed: z.boolean(),
  })
  .partial();
export type UpdateGoalDto = z.infer<typeof updateGoalSchema>;

export const goalQuerySchema = z.object({
  period: z.enum(GoalPeriods).optional(),
  includeCompleted: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});
export type GoalQueryDto = z.infer<typeof goalQuerySchema>;
