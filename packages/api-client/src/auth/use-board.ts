"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../client";
import type { BoardDetailDto } from "./types";

/**
 * One board in full: its theme, its statuses and its members.
 *
 * `apps/web` has written this query inline in nine places, all with the same
 * `["board", boardId]` key — which is why the key is kept exactly as it is.
 * Several web mutations invalidate that key directly, so a hook using any other
 * one would quietly stop seeing status and appearance edits.
 *
 * Mobile needs it for the selected board's palette, since `BoardSummaryDto`
 * deliberately carries no theme.
 */
export function useBoard(boardId: string | null | undefined) {
  return useQuery({
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId!}`),
    enabled: !!boardId,
  });
}
