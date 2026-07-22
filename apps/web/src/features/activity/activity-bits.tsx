import type { ComponentType } from "react";
import {
  CheckCircle2,
  FileUp,
  MessageSquare,
  Plus,
  RefreshCw,
  Target,
  UserMinus,
  UserPlus,
} from "lucide-react";
import type { ActivityType } from "@artist/shared";
import type { ActivityItemDto } from "./types";

const str = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

interface Rendered {
  icon: ComponentType<{ className?: string }>;
  /** Human sentence, minus the actor's name (the caller prepends it). */
  text: string;
}

/**
 * Turns a feed row into an icon and a sentence, entirely from its denormalized
 * `meta` — the feed never joins back to live records, so an entry still reads
 * correctly after its subject is renamed or deleted.
 */
export function renderActivity(item: ActivityItemDto): Rendered {
  const m = item.meta;
  switch (item.type as ActivityType) {
    case "TASK_CREATED":
      return {
        icon: Plus,
        text: `created ${str(m.isSubtask ? "subtask" : "task", "task")} “${str(m.taskTitle, "a task")}”`,
      };
    case "TASK_COMPLETED":
      return { icon: CheckCircle2, text: `completed “${str(m.taskTitle, "a task")}”` };
    case "STATUS_CHANGED":
      return {
        icon: RefreshCw,
        text: `moved “${str(m.taskTitle, "a task")}” from ${str(m.fromStatus)} to ${str(m.toStatus)}`,
      };
    case "MEMBER_ASSIGNED":
      return m.joinedBoard
        ? { icon: UserPlus, text: `joined the board` }
        : {
            icon: UserPlus,
            text: `assigned ${str(m.memberName, "someone")} to “${str(m.taskTitle, "a task")}”`,
          };
    case "MEMBER_REMOVED":
      return {
        icon: UserMinus,
        text: `removed ${str(m.memberName, "someone")} from “${str(m.taskTitle, "a task")}”`,
      };
    case "GOAL_COMPLETED":
      return { icon: Target, text: `completed goal “${str(m.goalTitle, "a goal")}”` };
    case "FILE_UPLOADED":
      return {
        icon: FileUp,
        text: `attached ${str(m.fileName, "a file")}${m.taskTitle ? ` to “${str(m.taskTitle)}”` : ""}`,
      };
    case "COMMENT_ADDED":
      return {
        icon: MessageSquare,
        text: `commented on “${str(m.taskTitle, "a task")}”`,
      };
    default:
      return { icon: RefreshCw, text: "did something" };
  }
}

/** Task id an entry points at, if any — lets a row deep-link to the task. */
export function activityTaskId(item: ActivityItemDto): string | null {
  return typeof item.meta.taskId === "string" ? item.meta.taskId : null;
}
