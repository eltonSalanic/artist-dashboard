"use client";

import { useState } from "react";
import { Archive, Link2Off, Plus } from "lucide-react";
import { usePermissions } from "@/features/auth/permissions";
import { StatusDot, SubtaskCount } from "@/features/tasks/task-bits";
import { useCreateTask, useTasks, useUpdateTask } from "@/features/tasks/use-tasks";
import type { TaskDto } from "@/features/tasks/types";
import { useDetailParams } from "./use-detail-params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/** Which side of the link this list belongs to — exactly one is set. */
export type TaskLink = { goalId: string } | { eventId: string };

/**
 * Shared "tasks attached to this goal/event" section: lists linked tasks,
 * lets admins create a new linked task, attach an existing one, or unlink.
 */
export function LinkedTasks({
  boardId,
  heading,
  tasks,
  isPending,
  link,
}: {
  boardId: string;
  heading: string;
  tasks: TaskDto[];
  isPending: boolean;
  link: TaskLink;
}) {
  const { can } = usePermissions();
  const { open } = useDetailParams();
  const createTask = useCreateTask(boardId);
  const updateTask = useUpdateTask(boardId);
  const canEdit = can("task.editFields");
  const [newTitle, setNewTitle] = useState("");

  const linkKey = "goalId" in link ? "goalId" : "eventId";
  const unlinkDto =
    linkKey === "goalId" ? { goalId: null } : { eventId: null };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{heading}</h3>

      {isPending ? (
        <Skeleton className="h-16" />
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks linked yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50"
            >
              <StatusDot color={task.status.color} />
              <button
                type="button"
                className={`min-w-0 flex-1 truncate text-left text-sm ${task.status.isDone ? "text-muted-foreground line-through" : ""}`}
                onClick={() => open("task", task.id)}
              >
                {task.title}
              </button>
              <SubtaskCount count={task.subtaskCount} />
              {task.archivedAt && (
                <span
                  className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                  title="Archived"
                >
                  <Archive aria-hidden className="size-3" />
                  <span className="sr-only">Archived</span>
                </span>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">
                {task.status.name}
              </span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Unlink ${task.title}`}
                  onClick={() =>
                    updateTask.mutate({ taskId: task.id, dto: unlinkDto })
                  }
                >
                  <Link2Off />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTitle.trim()) return;
              createTask.mutate({ title: newTitle.trim(), ...link });
              setNewTitle("");
            }}
          >
            <Input
              aria-label="New linked task title"
              placeholder="Add a task…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Button type="submit" variant="outline">
              <Plus data-icon="inline-start" />
              Add
            </Button>
          </form>
          <AttachExistingTask boardId={boardId} link={link} />
        </>
      )}
    </section>
  );
}

function AttachExistingTask({
  boardId,
  link,
}: {
  boardId: string;
  link: TaskLink;
}) {
  const allTasks = useTasks(boardId, { sort: "order" });
  const updateTask = useUpdateTask(boardId);

  const linkKey = "goalId" in link ? "goalId" : "eventId";
  const linkedId = "goalId" in link ? link.goalId : link.eventId;

  // Only offer root tasks that aren't already attached to this goal/event.
  const candidates = (allTasks.data ?? []).filter((task) => {
    if (task.parentTaskId) return false;
    const current = linkKey === "goalId" ? task.goal?.id : task.event?.id;
    return current !== linkedId;
  });

  if (candidates.length === 0) return null;

  return (
    <Select
      value=""
      onValueChange={(taskId) =>
        taskId &&
        updateTask.mutate({ taskId, dto: { [linkKey]: linkedId } })
      }
      items={candidates.map((task) => ({ value: task.id, label: task.title }))}
    >
      <SelectTrigger aria-label="Attach an existing task" size="sm">
        <SelectValue placeholder="Attach an existing task…" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {candidates.map((task) => (
            <SelectItem key={task.id} value={task.id}>
              {task.title}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
