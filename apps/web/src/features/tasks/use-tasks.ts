"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateTaskDto,
  UpdateTaskDto,
} from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import type { TaskDetailDto, TaskDto, TaskFilters } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

export function useTasks(boardId: string, filters: TaskFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return useQuery({
    queryKey: ["tasks", boardId, filters],
    queryFn: () =>
      apiFetch<TaskDto[]>(`/boards/${boardId}/tasks${qs ? `?${qs}` : ""}`),
  });
}

export function useTask(boardId: string, taskId: string | null) {
  return useQuery({
    queryKey: ["task", boardId, taskId],
    queryFn: () =>
      apiFetch<TaskDetailDto>(`/boards/${boardId}/tasks/${taskId}`),
    enabled: !!taskId,
  });
}

function useInvalidateTasks(boardId: string) {
  const queryClient = useQueryClient();
  return (taskId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["tasks", boardId] });
    if (taskId) {
      queryClient.invalidateQueries({ queryKey: ["task", boardId, taskId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["task", boardId] });
    }
  };
}

export function useCreateTask(boardId: string) {
  const invalidate = useInvalidateTasks(boardId);
  return useMutation({
    mutationFn: (dto: Partial<CreateTaskDto> & { title: string }) =>
      apiFetch<TaskDto>(`/boards/${boardId}/tasks`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: (task) => invalidate(task.parentTaskId ?? undefined),
    onError: showError,
  });
}

export function useUpdateTask(boardId: string) {
  const invalidate = useInvalidateTasks(boardId);
  return useMutation({
    mutationFn: ({ taskId, dto }: { taskId: string; dto: UpdateTaskDto }) =>
      apiFetch<TaskDto>(`/boards/${boardId}/tasks/${taskId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: (task) => invalidate(task.parentTaskId ?? task.id),
    onError: showError,
  });
}

export function useReorderTask(boardId: string) {
  const invalidate = useInvalidateTasks(boardId);
  return useMutation({
    mutationFn: ({
      taskId,
      afterTaskId,
    }: {
      taskId: string;
      afterTaskId: string | null;
    }) =>
      apiFetch(`/boards/${boardId}/tasks/${taskId}/reorder`, {
        method: "PATCH",
        body: { afterTaskId },
      }),
    onSuccess: () => invalidate(),
    onError: showError,
  });
}

export function useDeleteTask(boardId: string) {
  const invalidate = useInvalidateTasks(boardId);
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(`/boards/${boardId}/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => invalidate(),
    onError: showError,
  });
}

export function useSetAssignees(boardId: string) {
  const invalidate = useInvalidateTasks(boardId);
  return useMutation({
    mutationFn: ({
      taskId,
      assigneeIds,
    }: {
      taskId: string;
      assigneeIds: string[];
    }) =>
      apiFetch<TaskDto>(`/boards/${boardId}/tasks/${taskId}/assignees`, {
        method: "PATCH",
        body: { assigneeIds },
      }),
    onSuccess: (task) => invalidate(task.id),
    onError: showError,
  });
}

export function useChecklist(boardId: string, taskId: string) {
  const invalidate = useInvalidateTasks(boardId);
  const add = useMutation({
    mutationFn: (text: string) =>
      apiFetch(`/boards/${boardId}/tasks/${taskId}/checklist`, {
        method: "POST",
        body: { text },
      }),
    onSuccess: () => invalidate(taskId),
    onError: showError,
  });
  const update = useMutation({
    mutationFn: ({
      itemId,
      dto,
    }: {
      itemId: string;
      dto: { text?: string; done?: boolean };
    }) =>
      apiFetch(`/boards/${boardId}/tasks/${taskId}/checklist/${itemId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: () => invalidate(taskId),
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: (itemId: string) =>
      apiFetch(`/boards/${boardId}/tasks/${taskId}/checklist/${itemId}`, {
        method: "DELETE",
      }),
    onSuccess: () => invalidate(taskId),
    onError: showError,
  });
  return { add, update, remove };
}
