import type { EventType, Priority } from "@artist/shared";
import type { TaskStatusDto } from "@/features/auth/types";

export interface TaskAssigneeDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ChecklistItemDto {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskDto {
  id: string;
  boardId: string;
  title: string;
  description: string | null;
  priority: Priority;
  statusId: string;
  status: Pick<TaskStatusDto, "id" | "name" | "color" | "isDone">;
  dueDate: string | null;
  sortOrder: number;
  parentTaskId: string | null;
  goal: { id: string; title: string } | null;
  event: {
    id: string;
    title: string;
    type: EventType;
    startsAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssigneeDto[];
  checklist: ChecklistItemDto[];
  subtaskCount: number;
  checklistCount: number;
}

export interface TaskDetailDto extends TaskDto {
  createdBy: { id: string; displayName: string };
  subtasks: TaskDto[];
}

export interface TaskFilters {
  search?: string;
  statusId?: string;
  assigneeId?: string;
  priority?: Priority;
  goalId?: string;
  eventId?: string;
  sort?: "order" | "dueDate" | "priority" | "createdAt";
}
