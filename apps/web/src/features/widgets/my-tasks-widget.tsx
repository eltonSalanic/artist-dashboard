"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { apiFetch } from "@artist/api-client";
import { useMe } from "@artist/api-client";
import { usePermissions } from "@artist/api-client";
import type { BoardDetailDto } from "@artist/api-client";
import { TasksTable } from "@/features/tasks/tasks-table";
import {
  formatDueDate,
  StatusSelect,
  SubtaskCount,
} from "@/features/tasks/task-bits";
import { useTasks } from "@artist/api-client";
import { useTaskStatusChange } from "@/features/tasks/task-completion";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export function MyTasksWidget({ boardId }: { boardId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const me = useMe(true);
  const board = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId}`),
  });
  const userId = me.data?.user.id;
  const tasks = useTasks(
    boardId,
    userId ? { assigneeId: userId, sort: "dueDate" } : {},
  );
  const { changeStatus, dialog } = useTaskStatusChange(boardId);

  const statuses = board.data?.statuses ?? [];
  const rootTasks = (tasks.data ?? []).filter((t) => !t.parentTaskId);

  const openTask = (taskId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("task", taskId);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (tasks.isPending || board.isPending || me.isPending) {
    return <Skeleton className="h-full min-h-24" />;
  }

  if (rootTasks.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CheckCircle2 />
          </EmptyMedia>
          <EmptyTitle>Nothing assigned to you</EmptyTitle>
          <EmptyDescription>You&apos;re all caught up.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {dialog}
      <ul className="flex flex-col gap-1">
        {rootTasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50"
          >
            <button
              type="button"
              className={`min-w-0 flex-1 truncate text-left text-sm ${task.status.isDone ? "text-muted-foreground line-through" : ""}`}
              onClick={() => openTask(task.id)}
            >
              {task.title}
            </button>
            <SubtaskCount count={task.subtaskCount} />
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDueDate(task.dueDate)}
            </span>
            <StatusSelect
              value={task.statusId}
              statuses={statuses}
              disabled={!can("task.changeStatus")}
              onChange={(statusId) => changeStatus(task, statusId, statuses)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

export function MyTasksWidgetExpanded({ boardId }: { boardId: string }) {
  const me = useMe(true);
  if (!me.data) return <Skeleton className="h-40" />;
  return (
    <TasksTable
      boardId={boardId}
      initialFilters={{ assigneeId: me.data.user.id, sort: "dueDate" }}
      defaultAssigneeIds={[me.data.user.id]}
    />
  );
}
