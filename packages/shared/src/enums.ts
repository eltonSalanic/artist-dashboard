export const BoardRoles = ['ADMIN', 'USER'] as const;
export type BoardRole = (typeof BoardRoles)[number];

export const Priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof Priorities)[number];

export const EventTypes = ['SHOW', 'MEETING', 'REHEARSAL'] as const;
export type EventType = (typeof EventTypes)[number];

/**
 * What the app reads from a show status. "Played" is deliberately missing: a
 * held or booked show whose date has passed reads as played on its own.
 */
export const ShowStatusCategories = ['HOLD', 'BOOKED', 'CANCELLED'] as const;
export type ShowStatusCategory = (typeof ShowStatusCategories)[number];

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
  'FINANCE_ENTRY_ADDED',
  'SHOW_SETTLED',
  'PAYOUT_RECORDED',
  'SHOW_STATUS_CHANGED',
] as const;
export type ActivityType = (typeof ActivityTypes)[number];

/** The four things that can be archived. Shows/meetings/rehearsals are EVENT. */
export const ArchiveKinds = ['TASK', 'GOAL', 'EVENT', 'REMINDER'] as const;
export type ArchiveKind = (typeof ArchiveKinds)[number];

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
  'FINANCES',
  'CALENDAR',
] as const;
export type WidgetType = (typeof WidgetTypes)[number];

/** Which way money moved. Amounts are always positive; the kind is the sign. */
export const FinanceKinds = ['INCOME', 'EXPENSE'] as const;
export type FinanceKind = (typeof FinanceKinds)[number];

/**
 * EXPECTED is money promised but not in hand yet (a show fee the promoter still
 * owes). VOID replaces delete: a ledger that quietly loses rows can't be trusted.
 */
export const FinanceStates = ['EXPECTED', 'SETTLED', 'VOID'] as const;
export type FinanceState = (typeof FinanceStates)[number];

/**
 * Where a band's Band Pro subscription stands. GRACE (a renewal failed and the
 * store is retrying) and CANCELLED (auto-renew off, period not over) both
 * still have access; only EXPIRED loses it.
 */
export const SubscriptionStatuses = [
  'ACTIVE',
  'GRACE',
  'EXPIRED',
  'CANCELLED',
] as const;
export type SubscriptionStatus = (typeof SubscriptionStatuses)[number];

/** Who took the money. PROMOTIONAL is a grant from the RevenueCat dashboard. */
export const SubscriptionStores = [
  'APP_STORE',
  'PLAY_STORE',
  'STRIPE',
  'PROMOTIONAL',
] as const;
export type SubscriptionStore = (typeof SubscriptionStores)[number];
