"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "../client";
import type {
  CreateGoalDto,
  GoalPeriod,
  UpdateGoalDto,
} from "@artist/shared";
import { apiFetch } from "../client";
import { INLINE_ERROR, toUserMessage } from "../messages";
import type { GoalDto } from "./types";

const showError = (error: unknown) =>
  notify.error(toUserMessage(error));

export interface GoalFilters {
  period?: GoalPeriod;
  includeCompleted?: boolean;
}

export function useGoals(boardId: string, filters: GoalFilters = {}) {
  const params = new URLSearchParams();
  if (filters.period) params.set("period", filters.period);
  if (filters.includeCompleted === false) params.set("includeCompleted", "false");
  const qs = params.toString();
  return useQuery({
    queryKey: ["goals", boardId, filters],
    queryFn: () =>
      apiFetch<GoalDto[]>(`/boards/${boardId}/goals${qs ? `?${qs}` : ""}`),
  });
}

export function useGoal(boardId: string, goalId: string | null) {
  return useQuery({
    meta: INLINE_ERROR,
    queryKey: ["goal", boardId, goalId],
    queryFn: () => apiFetch<GoalDto>(`/boards/${boardId}/goals/${goalId}`),
    enabled: !!goalId,
  });
}

/**
 * Returned as a promise, and returned from `onSuccess`, so a mutation stays
 * pending until fresh data has landed — what lets a client show a tick
 * optimistically without it flickering back.
 *
 * Every calendar query, not just this board's: the phone's Calendar tab reads
 * the cross-board key (`["calendar", "all", …]`), which a board-scoped prefix
 * does not match.
 */
function useInvalidateGoals(boardId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["goals", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["goal", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      // A goal can be deleted from the archive page, so that list moves too.
      queryClient.invalidateQueries({ queryKey: ["archive", boardId] }),
    ]);
}

export function useCreateGoal(boardId: string) {
  const invalidate = useInvalidateGoals(boardId);
  return useMutation({
    mutationFn: (dto: Partial<CreateGoalDto> & { title: string }) =>
      apiFetch<GoalDto>(`/boards/${boardId}/goals`, { method: "POST", body: dto }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useUpdateGoal(boardId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateGoals(boardId);
  return useMutation({
    mutationFn: ({ goalId, dto }: { goalId: string; dto: UpdateGoalDto }) =>
      apiFetch<GoalDto>(`/boards/${boardId}/goals/${goalId}`, {
        method: "PATCH",
        body: dto,
      }),
    // Completing a goal also finishes its open tasks on the server, so every
    // task list and the feed are stale along with the goals.
    onSuccess: (_goal, { dto }) =>
      Promise.all([
        invalidate(),
        ...(dto.completed
          ? [
              queryClient.invalidateQueries({ queryKey: ["tasks", boardId] }),
              queryClient.invalidateQueries({ queryKey: ["task", boardId] }),
              queryClient.invalidateQueries({ queryKey: ["activity", boardId] }),
            ]
          : []),
      ]),
    onError: showError,
  });
}

export function useDeleteGoal(boardId: string) {
  const invalidate = useInvalidateGoals(boardId);
  return useMutation({
    mutationFn: ({
      goalId,
      cascadeTasks = false,
    }: {
      goalId: string;
      /** Delete the tasks linked to this goal along with it. */
      cascadeTasks?: boolean;
    }) =>
      apiFetch(
        `/boards/${boardId}/goals/${goalId}?cascadeTasks=${cascadeTasks}`,
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
    onError: showError,
  });
}
