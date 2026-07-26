"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ListChecks } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { usePermissions } from "@/features/auth/permissions";
import type { BoardDetailDto, TaskStatusDto } from "@/features/auth/types";
import { TasksTable } from "@/features/tasks/tasks-table";
import { formatDueDate, StatusSelect } from "@/features/tasks/task-bits";
import {
  useReorderTask,
  useTasks,
  useUpdateTask,
} from "@/features/tasks/use-tasks";
import type { TaskDto } from "@/features/tasks/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

function useBoard(boardId: string) {
  return useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId}`),
  });
}

function useOpenTask() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (taskId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("task", taskId);
    router.push(`?${params.toString()}`, { scroll: false });
  };
}

export function TodosWidget({ boardId }: { boardId: string }) {
  const { can } = usePermissions();
  const board = useBoard(boardId);
  const tasks = useTasks(boardId, { sort: "order" });
  const updateTask = useUpdateTask(boardId);
  const reorder = useReorderTask(boardId);
  const openTask = useOpenTask();

  const statuses = board.data?.statuses ?? [];
  const rootTasks = (tasks.data ?? []).filter((t) => !t.parentTaskId);
  const canReorder = can("task.editFields");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = rootTasks.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    const movedId = String(active.id);
    const movedIndex = next.indexOf(movedId);
    const afterTaskId = movedIndex === 0 ? null : next[movedIndex - 1];
    reorder.mutate({ taskId: movedId, afterTaskId });
  };

  if (tasks.isPending || board.isPending) {
    return <Skeleton className="h-full min-h-24" />;
  }

  if (rootTasks.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>No tasks yet</EmptyTitle>
          <EmptyDescription>
            Add tasks from the expanded view.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={rootTasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-1">
          {rootTasks.map((task) => (
            <TodoRow
              key={task.id}
              task={task}
              statuses={statuses}
              draggable={canReorder}
              statusDisabled={!can("task.changeStatus")}
              onOpen={() => openTask(task.id)}
              onStatusChange={(statusId) =>
                updateTask.mutate({ taskId: task.id, dto: { statusId } })
              }
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function TodoRow({
  task,
  statuses,
  draggable,
  statusDisabled,
  onOpen,
  onStatusChange,
}: {
  task: TaskDto;
  statuses: Pick<TaskStatusDto, "id" | "name" | "color">[];
  draggable: boolean;
  statusDisabled: boolean;
  onOpen: () => void;
  onStatusChange: (statusId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !draggable });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent/50"
    >
      {draggable && (
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label={`Reorder ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-sm"
        onClick={onOpen}
      >
        {task.title}
      </button>
      <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {task.dueDate ? formatDueDate(task.dueDate) : ""}
      </span>
      <StatusSelect
        value={task.statusId}
        statuses={statuses}
        disabled={statusDisabled}
        onChange={onStatusChange}
        className="w-36"
      />
    </li>
  );
}

export function TodosWidgetExpanded({ boardId }: { boardId: string }) {
  return <TasksTable boardId={boardId} />;
}
