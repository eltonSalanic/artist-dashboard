"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ACTIVITY_PAGE_SIZE } from "@artist/shared";
import { apiFetch } from "@/lib/api";
import type { ActivityPage } from "./types";

/**
 * Cursor-paginated feed. The collapsed widget shows the first page; the
 * expanded view adds a "Load more" that walks `nextCursor`.
 */
export function useActivityFeed(boardId: string, limit = ACTIVITY_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: ["activity", boardId, limit],
    queryFn: ({ pageParam }) =>
      apiFetch<ActivityPage>(
        `/boards/${boardId}/activity?limit=${limit}` +
          (pageParam ? `&cursor=${pageParam}` : ""),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}
