"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
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
  return useQuery(boardQuery(boardId));
}

/**
 * Several boards in full, one query each under the same key `useBoard` uses,
 * so a board already open elsewhere is not fetched twice and every mutation
 * that refreshes one board refreshes it here too.
 *
 * For a screen that paints many bands at once, such as the phone's calendar
 * colouring each item by its own band's widget colours.
 */
export function useBoards(boardIds: readonly string[]) {
  return useQueries({ queries: boardIds.map((boardId) => boardQuery(boardId)) });
}

function boardQuery(boardId: string | null | undefined) {
  return {
    queryKey: ["board", boardId],
    queryFn: () => apiFetch<BoardDetailDto>(`/boards/${boardId!}`),
    enabled: !!boardId,
  };
}
