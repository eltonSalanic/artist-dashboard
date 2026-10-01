import type { EventType, FocusPeriod, GoalPeriod } from "@artist/shared";

export interface GoalDto {
  id: string;
  boardId: string;
  title: string;
  description: string | null;
  period: GoalPeriod;
  dueDate: string | null;
  completedAt: string | null;
  /** Set once the goal has been archived off the dashboard. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Live tasks only — the number the "also archive N tasks" prompt shows. */
  taskCount: number;
  /** Tasks archived as part of this goal. Detail responses only. */
  archivedTaskCount?: number;
  /** Every linked task, archived or not — what a cascading delete takes. */
  linkedTaskCount?: number;
}

export interface EventDto {
  id: string;
  boardId: string;
  type: EventType;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  /** Set once the event has been archived off the dashboard. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Live tasks only — the number the "also archive N tasks" prompt shows. */
  taskCount: number;
  /** Tasks archived as part of this event. Detail responses only. */
  archivedTaskCount?: number;
  /** Every linked task, archived or not — what a cascading delete takes. */
  linkedTaskCount?: number;
}

export interface FocusPinDto {
  period: FocusPeriod;
  text: string;
  updatedAt?: string;
}

export interface ReminderDto {
  id: string;
  boardId: string;
  title: string;
  description: string | null;
  /** Null for standing notes that aren't tied to a moment. */
  remindAt: string | null;
  done: boolean;
  /** Set once the reminder has been archived off the dashboard. */
  archivedAt: string | null;
  createdAt: string;
}

export type CalendarItemKind = "EVENT" | "TASK" | "GOAL" | "REMINDER";

export interface CalendarItemDto {
  kind: CalendarItemKind;
  id: string;
  title: string;
  date: string;
  event?: { type: EventType; endsAt: string | null; location: string | null };
  task?: {
    statusColor: string;
    statusName: string;
    isDone: boolean;
    /** True when the signed-in user is one of the task's assignees. */
    assignedToMe: boolean;
  };
  goal?: { period: GoalPeriod; completed: boolean };
}
