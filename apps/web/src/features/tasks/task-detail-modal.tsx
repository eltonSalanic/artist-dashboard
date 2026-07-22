"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { usePermissions } from "@/features/auth/permissions";
import type { BoardDetailDto, BoardMemberDto, TaskStatusDto } from "@/features/auth/types";
import { useGoals } from "@/features/planning/use-goals";
import { useEvents } from "@/features/planning/use-events";
import { useDetailParams } from "@/features/planning/use-detail-params";
import { eventTypeLabel, formatDateTime } from "@/features/planning/planning-bits";
import { CommentsSection } from "@/features/comments/comments-section";
import { TaskAttachments } from "@/features/comments/task-attachments";
import type { TaskDetailDto } from "./types";
import {
  useChecklist,
  useCreateTask,
  useDeleteTask,
  useSetAssignees,
  useTask,
  useUpdateTask,
} from "./use-tasks";
import {
  AssigneeAvatars,
  formatDueDate,
  PriorityBadge,
  StatusSelect,
} from "./task-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export function TaskDetailModal({ boardId }: { boardId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");

  const close = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("task");
    router.push(params.size ? `?${params.toString()}` : "?", { scroll: false });
  };

  return (
    <Dialog open={!!taskId} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {taskId && (
          <TaskDetail
            key={taskId}
            boardId={boardId}
            taskId={taskId}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetail({
  boardId,
  taskId,
  onClose,
}: {
  boardId: string;
  taskId: string;
  onClose: () => void;
}) {
  const task = useTask(boardId, taskId);
  const board = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId}`),
  });

  if (task.isPending || !board.data) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle className="sr-only">Loading task</DialogTitle>
        </DialogHeader>
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (task.isError || !task.data) {
    return (
      <DialogHeader>
        <DialogTitle>Task not found</DialogTitle>
        <DialogDescription>
          It may have been deleted by an admin.
        </DialogDescription>
      </DialogHeader>
    );
  }

  return (
    <TaskDetailBody
      boardId={boardId}
      taskId={taskId}
      data={task.data}
      statuses={board.data.statuses}
      members={board.data.members}
      onClose={onClose}
    />
  );
}

/** Sentinel for "no goal/event" — Base UI selects need a non-empty value. */
const NO_LINK = "__none__";

function TaskLinks({
  boardId,
  taskId,
  data,
}: {
  boardId: string;
  taskId: string;
  data: TaskDetailDto;
}) {
  const { can } = usePermissions();
  const { swap } = useDetailParams();
  const updateTask = useUpdateTask(boardId);
  const goals = useGoals(boardId, { includeCompleted: false });
  const events = useEvents(boardId);
  const canEdit = can("task.editFields");

  const goalItems = [
    { value: NO_LINK, label: "No goal" },
    ...(goals.data ?? []).map((goal) => ({
      value: goal.id,
      label: goal.title,
    })),
  ];
  const eventItems = [
    { value: NO_LINK, label: "No event" },
    ...(events.data ?? []).map((event) => ({
      value: event.id,
      label: `${eventTypeLabel[event.type]} · ${event.title}`,
    })),
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="task-goal">Goal</FieldLabel>
        {canEdit ? (
          <Select
            value={data.goal?.id ?? NO_LINK}
            onValueChange={(value) =>
              value &&
              updateTask.mutate({
                taskId,
                dto: { goalId: value === NO_LINK ? null : value },
              })
            }
            items={goalItems}
          >
            <SelectTrigger id="task-goal" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {goalItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : data.goal ? (
          <button
            type="button"
            className="truncate text-left text-sm underline-offset-4 hover:underline"
            onClick={() => swap("task", "goal", data.goal!.id)}
          >
            {data.goal.title}
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
        {canEdit && data.goal && (
          <button
            type="button"
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => swap("task", "goal", data.goal!.id)}
          >
            Open goal
          </button>
        )}
      </Field>

      <Field>
        <FieldLabel htmlFor="task-event">Event</FieldLabel>
        {canEdit ? (
          <Select
            value={data.event?.id ?? NO_LINK}
            onValueChange={(value) =>
              value &&
              updateTask.mutate({
                taskId,
                dto: { eventId: value === NO_LINK ? null : value },
              })
            }
            items={eventItems}
          >
            <SelectTrigger id="task-event" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {eventItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : data.event ? (
          <button
            type="button"
            className="truncate text-left text-sm underline-offset-4 hover:underline"
            onClick={() => swap("task", "event", data.event!.id)}
          >
            {data.event.title} · {formatDateTime(data.event.startsAt)}
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
        {canEdit && data.event && (
          <button
            type="button"
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => swap("task", "event", data.event!.id)}
          >
            Open event
          </button>
        )}
      </Field>
    </div>
  );
}

function TaskDetailBody({
  boardId,
  taskId,
  data,
  statuses,
  members,
  onClose,
}: {
  boardId: string;
  taskId: string;
  data: TaskDetailDto;
  statuses: TaskStatusDto[];
  members: BoardMemberDto[];
  onClose: () => void;
}) {
  const { can } = usePermissions();
  const updateTask = useUpdateTask(boardId);
  const deleteTask = useDeleteTask(boardId);
  const setAssignees = useSetAssignees(boardId);
  const createSubtask = useCreateTask(boardId);
  const checklist = useChecklist(boardId, taskId);

  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description ?? "");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [checklistText, setChecklistText] = useState("");

  const canEdit = can("task.editFields");
  const assigneeIds = new Set(data.assignees.map((a) => a.id));

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== data.title) {
      updateTask.mutate({ taskId, dto: { title: trimmed } });
    }
  };
  const saveDescription = () => {
    const value = description.trim() || null;
    if (value !== (data.description ?? null)) {
      updateTask.mutate({ taskId, dto: { description: value } });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        {canEdit ? (
          <Input
            aria-label="Task title"
            className="border-none pr-8 text-lg font-semibold shadow-none focus-visible:ring-0"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => e.key === "Enter" && saveTitle()}
          />
        ) : (
          <DialogTitle>{data.title}</DialogTitle>
        )}
        <DialogDescription>
          Created by {data.createdBy.displayName} ·{" "}
          {new Date(data.createdAt).toLocaleDateString()}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field>
          <FieldLabel htmlFor="task-status">Status</FieldLabel>
          <StatusSelect
            id="task-status"
            value={data.statusId}
            statuses={statuses}
            disabled={!can("task.changeStatus")}
            onChange={(statusId) => updateTask.mutate({ taskId, dto: { statusId } })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
          {canEdit ? (
            <Select
              value={data.priority}
              onValueChange={(priority) =>
                updateTask.mutate({
                  taskId,
                  dto: { priority: priority as typeof data.priority },
                })
              }
              items={[
                { value: "HIGH", label: "High" },
                { value: "MEDIUM", label: "Medium" },
                { value: "LOW", label: "Low" },
              ]}
            >
              <SelectTrigger id="task-priority" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <PriorityBadge priority={data.priority} />
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="task-due">Due date</FieldLabel>
          {canEdit ? (
            <DateTimePicker
              id="task-due"
              placeholder="No due date"
              value={data.dueDate ? data.dueDate.slice(0, 10) : ""}
              onChange={(value) =>
                updateTask.mutate({
                  taskId,
                  dto: {
                    dueDate: value ? new Date(value).toISOString() : null,
                  },
                })
              }
            />
          ) : (
            <span className="text-sm text-muted-foreground">
              {formatDueDate(data.dueDate)}
            </span>
          )}
        </Field>
        <Field>
          <FieldLabel>Assignees</FieldLabel>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="sm" />}
              >
                {data.assignees.length > 0 ? (
                  <AssigneeAvatars assignees={data.assignees} />
                ) : (
                  "Assign"
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Board members</DropdownMenuLabel>
                  {members.map((member) => (
                    <DropdownMenuCheckboxItem
                      key={member.userId}
                      checked={assigneeIds.has(member.userId)}
                      onCheckedChange={(checked) => {
                        const next = new Set(assigneeIds);
                        if (checked) next.add(member.userId);
                        else next.delete(member.userId);
                        setAssignees.mutate({
                          taskId,
                          assigneeIds: [...next],
                        });
                      }}
                    >
                      {member.displayName}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <AssigneeAvatars assignees={data.assignees} />
          )}
        </Field>
      </div>

      <TaskLinks boardId={boardId} taskId={taskId} data={data} />

      <Field>
        <FieldLabel htmlFor="task-description">Description</FieldLabel>
        {canEdit ? (
          <Textarea
            id="task-description"
            placeholder="Add details…"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {data.description || "No description."}
          </p>
        )}
      </Field>

      <Separator />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Checklist</h3>
        {data.checklist.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Checkbox
              checked={item.done}
              aria-label={item.text}
              onCheckedChange={(done) =>
                checklist.update.mutate({
                  itemId: item.id,
                  dto: { done: done === true },
                })
              }
            />
            <span
              className={`flex-1 text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}
            >
              {item.text}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${item.text}`}
              onClick={() => checklist.remove.mutate(item.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (checklistText.trim()) {
              checklist.add.mutate(checklistText.trim());
              setChecklistText("");
            }
          }}
        >
          <Input
            aria-label="New checklist item"
            placeholder="Add checklist item…"
            value={checklistText}
            onChange={(e) => setChecklistText(e.target.value)}
          />
          <Button type="submit" variant="outline">
            <Plus data-icon="inline-start" />
            Add
          </Button>
        </form>
      </section>

      {!data.parentTaskId && (
        <>
          <Separator />
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Subtasks</h3>
            {data.subtasks.map((subtask) => (
              <div key={subtask.id} className="flex items-center gap-2">
                <StatusSelect
                  value={subtask.statusId}
                  statuses={statuses}
                  disabled={!can("task.changeStatus")}
                  onChange={(statusId) =>
                    updateTask.mutate({ taskId: subtask.id, dto: { statusId } })
                  }
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {subtask.title}
                </span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${subtask.title}`}
                    onClick={() => deleteTask.mutate(subtask.id)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
            {can("task.createSubtask") && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (subtaskTitle.trim()) {
                    createSubtask.mutate({
                      title: subtaskTitle.trim(),
                      parentTaskId: taskId,
                    });
                    setSubtaskTitle("");
                  }
                }}
              >
                <Input
                  aria-label="New subtask title"
                  placeholder="Add subtask…"
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                />
                <Button type="submit" variant="outline">
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              </form>
            )}
          </section>
        </>
      )}

      <Separator />
      <TaskAttachments boardId={boardId} taskId={taskId} />

      <Separator />
      <CommentsSection boardId={boardId} taskId={taskId} members={members} />

      {can("task.delete") && (
        <>
          <Separator />
          <div className="flex justify-end">
            <Button
              variant="destructive"
              disabled={deleteTask.isPending}
              onClick={() => {
                deleteTask.mutate(taskId, { onSuccess: onClose });
              }}
            >
              <Trash2 data-icon="inline-start" />
              Delete task
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
