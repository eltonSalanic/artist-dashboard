"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Plus, Search } from "lucide-react";
import type { Priority } from "@artist/shared";
import { apiFetch } from "@/lib/api";
import { usePermissions } from "@/features/auth/permissions";
import type { BoardDetailDto } from "@/features/auth/types";
import { useCreateTask, useTasks, useUpdateTask } from "./use-tasks";
import type { TaskFilters } from "./types";
import {
  AssigneeAvatars,
  formatDueDate,
  PriorityBadge,
  StatusSelect,
} from "./task-bits";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ALL = "__all__";

export function TasksTable({
  boardId,
  initialFilters,
}: {
  boardId: string;
  initialFilters?: TaskFilters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const [filters, setFilters] = useState<TaskFilters>(initialFilters ?? {});
  const [newTitle, setNewTitle] = useState("");

  const board = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId}`),
  });
  const tasks = useTasks(boardId, filters);
  const createTask = useCreateTask(boardId);
  const updateTask = useUpdateTask(boardId);

  const statuses = board.data?.statuses ?? [];
  const rootTasks = tasks.data?.filter((t) => !t.parentTaskId) ?? [];

  const openTask = (taskId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("task", taskId);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const submitNewTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim()) return;
    createTask.mutate({ title: newTitle.trim() });
    setNewTitle("");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search tasks"
            placeholder="Search tasks…"
            className="w-56 pl-8"
            value={filters.search ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value || undefined }))
            }
          />
        </div>
        <Select
          value={filters.statusId ?? ALL}
          onValueChange={(v) =>
            setFilters((f) => ({
              ...f,
              statusId: !v || v === ALL ? undefined : v,
            }))
          }
          items={[
            { value: ALL, label: "All statuses" },
            ...statuses.map((s) => ({ value: s.id, label: s.name })),
          ]}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={filters.priority ?? ALL}
          onValueChange={(v) =>
            setFilters((f) => ({
              ...f,
              priority: !v || v === ALL ? undefined : (v as Priority),
            }))
          }
          items={[
            { value: ALL, label: "All priorities" },
            { value: "HIGH", label: "High" },
            { value: "MEDIUM", label: "Medium" },
            { value: "LOW", label: "Low" },
          ]}
        >
          <SelectTrigger className="w-36" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL}>All priorities</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          value={filters.sort ?? "order"}
          onValueChange={(v) =>
            v &&
            setFilters((f) => ({ ...f, sort: v as TaskFilters["sort"] }))
          }
          items={[
            { value: "order", label: "Board order" },
            { value: "dueDate", label: "Due date" },
            { value: "priority", label: "Priority" },
            { value: "createdAt", label: "Newest" },
          ]}
        >
          <SelectTrigger className="w-36" aria-label="Sort tasks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="order">Board order</SelectItem>
              <SelectItem value="dueDate">Due date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="createdAt">Newest</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {can("task.create") && (
        <form onSubmit={submitNewTask} className="flex gap-2">
          <Input
            aria-label="New task title"
            placeholder="Add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button type="submit" disabled={createTask.isPending}>
            <Plus data-icon="inline-start" />
            Add
          </Button>
        </form>
      )}

      {tasks.isPending ? (
        <Skeleton className="h-48" />
      ) : rootTasks.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks />
            </EmptyMedia>
            <EmptyTitle>No tasks yet</EmptyTitle>
            <EmptyDescription>
              {can("task.create")
                ? "Add your band's first task above."
                : "Your board admin hasn't added tasks yet."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead className="w-40">Status</TableHead>
                <TableHead className="w-28">Priority</TableHead>
                <TableHead className="w-24">Due</TableHead>
                <TableHead className="w-28">Assignees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rootTasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer"
                  onClick={() => openTask(task.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{task.title}</span>
                      {task.subtaskCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {task.subtaskCount} subtask
                          {task.subtaskCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusSelect
                      value={task.statusId}
                      statuses={statuses}
                      disabled={!can("task.changeStatus")}
                      onChange={(statusId) =>
                        updateTask.mutate({
                          taskId: task.id,
                          dto: { statusId },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDueDate(task.dueDate)}
                  </TableCell>
                  <TableCell>
                    <AssigneeAvatars assignees={task.assignees} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
