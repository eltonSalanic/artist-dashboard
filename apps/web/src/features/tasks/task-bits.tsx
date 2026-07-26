"use client";

import type { Priority } from "@artist/shared";
import { ListTree } from "lucide-react";
import type { TaskStatusDto } from "@/features/auth/types";
import type { TaskAssigneeDto } from "./types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * "2 subtasks" on a task row, so a parent reads as a parent everywhere it's
 * listed — not just in the expanded table. Renders nothing at zero.
 */
export function SubtaskCount({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <ListTree aria-hidden className="size-3" />
      {count}
      <span className="sr-only">{count === 1 ? "subtask" : "subtasks"}</span>
    </span>
  );
}

export function StatusSelect({
  value,
  statuses,
  onChange,
  disabled,
  id,
  className,
}: {
  value: string;
  statuses: Pick<TaskStatusDto, "id" | "name" | "color">[];
  onChange: (statusId: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v)}
      disabled={disabled}
      items={statuses.map((status) => ({
        value: status.id,
        label: (
          <span className="flex items-center gap-1.5">
            <StatusDot color={status.color} />
            {status.name}
          </span>
        ),
      }))}
    >
      <SelectTrigger
        id={id}
        size="sm"
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {statuses.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              <span className="flex items-center gap-1.5">
                <StatusDot color={status.color} />
                {status.name}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

const priorityLabel: Record<Priority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant={
        priority === "HIGH"
          ? "destructive"
          : priority === "MEDIUM"
            ? "secondary"
            : "outline"
      }
    >
      {priorityLabel[priority]}
    </Badge>
  );
}

export function AssigneeAvatars({
  assignees,
  max = 3,
  size = "size-6",
}: {
  assignees: TaskAssigneeDto[];
  max?: number;
  size?: string;
}) {
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((assignee) => (
        <Avatar key={assignee.id} className={cn(size, "ring-2 ring-background")}>
          <AvatarFallback className="text-[10px]">
            {assignee.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <Avatar className={cn(size, "ring-2 ring-background")}>
          <AvatarFallback className="text-[10px]">+{extra}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

/**
 * Due dates are calendar days stored as UTC midnight (from `<input type="date">`).
 * Format in UTC so local timezones west of UTC don't shift the day back.
 */
export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "—";
  return new Date(dueDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
