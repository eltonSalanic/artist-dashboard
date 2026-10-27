import type {
  EventType,
  FocusPeriod,
  GoalPeriod,
  ShowStatusCategory,
} from "@artist/shared";
import type { ShowStatusDto } from "../auth/types";

export interface GoalDto {
  id: string;
  boardId: string;
  title: string;
  period: GoalPeriod;
  dueDate: string | null;
  completedAt: string | null;
  /** Set once the goal has been archived off the dashboard. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Live tasks only — the number the "also archive N tasks" prompt shows. */
  taskCount: number;
  /**
   * Live tasks not yet done. Completing the goal finishes them, which the
   * confirmation names before asking.
   */
  openTaskCount: number;
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
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  /** Set once the event has been archived off the dashboard. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Shows only; null for meetings and rehearsals. */
  showStatusId: string | null;
  showStatus: Omit<ShowStatusDto, "sortOrder"> | null;
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
  /**
   * Which board the item came from. Always present, including on the
   * single-board route — merged across bands it is what disambiguates two
   * items with the same title, and every click-through URL is board-scoped.
   */
  boardId: string;
  boardName: string;
  title: string;
  date: string;
  event?: {
    type: EventType;
    endsAt: string | null;
    location: string | null;
    /** Shows only. Cancelled shows are included; filter them client-side. */
    showStatus: {
      name: string;
      color: string;
      category: ShowStatusCategory;
    } | null;
  };
  task?: {
    statusColor: string;
    statusName: string;
    isDone: boolean;
    /** True when the signed-in user is one of the task's assignees. */
    assignedToMe: boolean;
  };
  goal?: { period: GoalPeriod; completed: boolean };
}
