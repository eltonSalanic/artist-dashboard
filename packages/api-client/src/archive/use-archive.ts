"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "../client";
import type { ArchiveKind } from "@artist/shared";
import { apiFetch, ApiError } from "../client";
import type { ArchiveItemDto } from "./types";

const showError = (error: unknown) =>
  notify.error(error instanceof ApiError ? error.message : "Something went wrong");

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
 *
 * Every calendar query, not just this board's: the phone's Calendar tab reads
 * the cross-board key (`["calendar", "all", …]`), which a board prefix misses.
 */
function useInvalidateArchive(boardId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      ...[
        "archive",
        "tasks",
        "task",
        "goals",
        "goal",
        "events",
        "event",
        "reminders",
        "reminder",
      ].map((key) => queryClient.invalidateQueries({ queryKey: [key, boardId] })),
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
    ]);
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
      notify.success("Moved to the archive");
      return invalidate();
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
      notify.success("Back on your dashboard");
      return invalidate();
    },
    onError: showError,
  });
}
