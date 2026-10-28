"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notify } from "../client";
import type {
  CreateTaskDto,
  UpdateTaskDto,
} from "@artist/shared";
import { apiFetch } from "../client";
import { toUserMessage } from "../messages";
import type { TaskDetailDto, TaskDto, TaskFilters } from "./types";

const showError = (error: unknown) =>
  notify.error(toUserMessage(error));

export function useTasks(boardId: string, filters: TaskFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    // Skip empty and false — an unset flag shouldn't reach the query string.
    if (value === undefined || value === "" || value === false) continue;
    params.set(key, String(value));
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

/**
 * Returns the refetch as a promise, and the mutations below return it from
 * `onSuccess`, so a mutation stays pending until fresh data has landed. A
 * client rendering the pending `variables` optimistically (a ticked box) then
 * never flickers back to the stale value between "saved" and "refetched".
 */
function useInvalidateTasks(boardId: string) {
  const queryClient = useQueryClient();
  return (taskId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks", boardId] }),
      taskId
        ? queryClient.invalidateQueries({ queryKey: ["task", boardId, taskId] })
        : queryClient.invalidateQueries({ queryKey: ["task", boardId] }),
      // A task can be deleted from the archive page, so that list moves too.
      queryClient.invalidateQueries({ queryKey: ["archive", boardId] }),
      // Due tasks are on the calendar — every calendar query, for the same
      // reason as the planning hooks: the cross-board key has no board prefix.
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      // Goals and events count their tasks (`taskCount`, `openTaskCount`), and
      // linking, unlinking or finishing a task changes those counts — the
      // goal-completion prompt quotes `openTaskCount`, so a stale one lies.
      queryClient.invalidateQueries({ queryKey: ["goals", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["goal", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["events", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["event", boardId] }),
    ]);
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
    // Both: web edits a subtask inside its parent's modal, but on mobile a
    // subtask is its own screen, and that one would otherwise stay stale.
    onSuccess: (task) =>
      Promise.all([
        invalidate(task.id),
        task.parentTaskId ? invalidate(task.parentTaskId) : undefined,
      ]),
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
    onSuccess: () => {
      invalidate();
      notify.success("Task deleted");
    },
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
