import type { EventType, FocusPeriod, GoalPeriod } from "@artist/shared";

export interface GoalDto {
  id: string;
  boardId: string;
  title: string;
  description: string | null;
  period: GoalPeriod;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
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
  createdAt: string;
  updatedAt: string;
  taskCount: number;
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
  createdAt: string;
}

export type CalendarItemKind = "EVENT" | "TASK" | "GOAL" | "REMINDER";

export interface CalendarItemDto {
  kind: CalendarItemKind;
  id: string;
  title: string;
  date: string;
  event?: { type: EventType; endsAt: string | null; location: string | null };
  task?: { statusColor: string; statusName: string; isDone: boolean };
  goal?: { period: GoalPeriod; completed: boolean };
  reminder?: { done: boolean };
}
