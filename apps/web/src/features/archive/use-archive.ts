"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ArchiveKind } from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import type { ArchiveItemDto } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

export function useArchive(boardId: string) {
  return useQuery({
    queryKey: ["archive", boardId],
    queryFn: () => apiFetch<ArchiveItemDto[]>(`/boards/${boardId}/archive`),
  });
}

/**
 * Archiving moves an item between the dashboard and the archive, so both
 * sides of that line have to be refetched — every entity list, both detail
 * keys, the calendar, and the archive itself.
 */
function useInvalidateArchive(boardId: string) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      "archive",
      "tasks",
      "task",
      "goals",
      "goal",
      "events",
      "event",
      "reminders",
      "reminder",
      "calendar",
    ]) {
      queryClient.invalidateQueries({ queryKey: [key, boardId] });
    }
  };
}

export interface ArchiveVariables {
  kind: ArchiveKind;
  id: string;
  /** Sweep the event's or goal's linked tasks along with it. */
  cascadeTasks?: boolean;
}

export function useArchiveItem(boardId: string) {
  const invalidate = useInvalidateArchive(boardId);
  return useMutation({
    mutationFn: ({ kind, id, cascadeTasks = false }: ArchiveVariables) =>
      apiFetch(`/boards/${boardId}/archive/${kind}/${id}`, {
        method: "POST",
        body: { cascadeTasks },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Moved to the archive");
    },
    onError: showError,
  });
}

export function useRestoreItem(boardId: string) {
  const invalidate = useInvalidateArchive(boardId);
  return useMutation({
    mutationFn: ({ kind, id, cascadeTasks = false }: ArchiveVariables) =>
      apiFetch(`/boards/${boardId}/archive/${kind}/${id}/restore`, {
        method: "POST",
        body: { cascadeTasks },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Back on your dashboard");
    },
    onError: showError,
  });
}
