export const BoardRoles = ['ADMIN', 'USER'] as const;
export type BoardRole = (typeof BoardRoles)[number];

export const Priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof Priorities)[number];

export const EventTypes = ['SHOW', 'MEETING', 'REHEARSAL'] as const;
export type EventType = (typeof EventTypes)[number];

export const GoalPeriods = ['YEARLY', 'MONTHLY', 'DAILY'] as const;
export type GoalPeriod = (typeof GoalPeriods)[number];

export const FocusPeriods = ['WEEK', 'MONTH', 'YEAR'] as const;
export type FocusPeriod = (typeof FocusPeriods)[number];

export const ActivityTypes = [
  'TASK_CREATED',
  'TASK_COMPLETED',
  'STATUS_CHANGED',
  'MEMBER_ASSIGNED',
  'MEMBER_REMOVED',
  'GOAL_COMPLETED',
  'FILE_UPLOADED',
  'COMMENT_ADDED',
] as const;
export type ActivityType = (typeof ActivityTypes)[number];

export const WidgetTypes = [
  'GOALS',
  'FOCUS',
  'TODOS',
  'NEXT_REHEARSALS',
  'NEXT_MEETINGS',
  'SHOWS',
  'REMINDERS',
  'MY_TASKS',
  'CUSTOM',
  'ACTIVITY_FEED',
  'CALENDAR',
] as const;
export type WidgetType = (typeof WidgetTypes)[number];
