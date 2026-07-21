"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { CalendarItemDto } from "./types";

/** Range is [from, to) — both ISO instants. */
export function useCalendar(boardId: string, from: string, to: string) {
  return useQuery({
    queryKey: ["calendar", boardId, from, to],
    queryFn: () =>
      apiFetch<CalendarItemDto[]>(
        `/boards/${boardId}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ),
  });
}
