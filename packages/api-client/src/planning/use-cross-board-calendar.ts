"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import type { CalendarItemDto } from "./types";

/**
 * The calendar across every band the caller is in.
 *
 * Range is [from, to) — both ISO instants, at most 370 days apart, which the
 * server enforces. `boardId` narrows *within* the caller's membership; it never
 * replaces it.
 *
 * Deliberately one request, not one per board. The cross-board endpoint exists
 * so the `boardId IN (...)` happens in Postgres; fanning `useCalendar` out over
 * a membership list from the client would turn the one thing this phase was
 * designed to avoid — an N+1 of per-board calls — into the default.
 */
export function useAllBoardsCalendar(
  from: string,
  to: string,
  boardId?: string,
) {
  return useQuery({
    queryKey: ["calendar", "all", boardId ?? "all", from, to],
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      if (boardId !== undefined) params.set("boardId", boardId);
      return apiFetch<CalendarItemDto[]>(`/calendar?${params.toString()}`);
    },
  });
}
