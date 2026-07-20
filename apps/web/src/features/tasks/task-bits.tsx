"use client";

import type { Priority } from "@artist/shared";
import type { TaskStatusDto } from "@/features/auth/types";
import type { TaskAssigneeDto } from "./types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

export function StatusSelect({
  value,
  statuses,
  onChange,
  disabled,
  id,
}: {
  value: string;
  statuses: Pick<TaskStatusDto, "id" | "name" | "color">[];
  onChange: (statusId: string) => void;
  disabled?: boolean;
  id?: string;
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
      <SelectTrigger id={id} size="sm" onClick={(e) => e.stopPropagation()}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {statuses.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              <StatusDot color={status.color} />
              {status.name}
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
}: {
  assignees: TaskAssigneeDto[];
  max?: number;
}) {
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((assignee) => (
        <Avatar key={assignee.id} className="size-6 ring-2 ring-background">
          <AvatarFallback className="text-[10px]">
            {assignee.displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <Avatar className="size-6 ring-2 ring-background">
          <AvatarFallback className="text-[10px]">+{extra}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "—";
  return new Date(dueDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
