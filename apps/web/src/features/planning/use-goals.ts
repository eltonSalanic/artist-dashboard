"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateGoalDto,
  GoalPeriod,
  UpdateGoalDto,
} from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import type { GoalDto } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

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
    queryKey: ["goal", boardId, goalId],
    queryFn: () => apiFetch<GoalDto>(`/boards/${boardId}/goals/${goalId}`),
    enabled: !!goalId,
  });
}

function useInvalidateGoals(boardId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["goals", boardId] });
    queryClient.invalidateQueries({ queryKey: ["goal", boardId] });
    queryClient.invalidateQueries({ queryKey: ["calendar", boardId] });
    // A goal can be deleted from the archive page, so that list moves too.
    queryClient.invalidateQueries({ queryKey: ["archive", boardId] });
  };
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
  const invalidate = useInvalidateGoals(boardId);
  return useMutation({
    mutationFn: ({ goalId, dto }: { goalId: string; dto: UpdateGoalDto }) =>
      apiFetch<GoalDto>(`/boards/${boardId}/goals/${goalId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: invalidate,
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
