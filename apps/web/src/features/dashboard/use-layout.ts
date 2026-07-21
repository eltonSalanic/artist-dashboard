"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LayoutItem } from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";

interface LayoutResponse {
  layout: LayoutItem[];
}

const showError = (error: unknown) =>
  toast.error(
    error instanceof ApiError ? error.message : "Couldn't save layout",
  );

export function useLayout(boardId: string) {
  return useQuery({
    queryKey: ["layout", boardId],
    queryFn: () => apiFetch<LayoutResponse>(`/boards/${boardId}/layout`),
  });
}

export function useSaveLayout(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (layout: LayoutItem[]) =>
      apiFetch<LayoutResponse>(`/boards/${boardId}/layout`, {
        method: "PUT",
        body: { layout },
      }),
    // Optimistic: the grid already shows the new positions, so update the
    // cache immediately rather than waiting on the round-trip.
    onMutate: (layout) => {
      queryClient.setQueryData(["layout", boardId], { layout });
    },
    onSuccess: (data) =>
      queryClient.setQueryData(["layout", boardId], data),
    onError: showError,
  });
}

export function useSaveDefaultLayout(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (layout: LayoutItem[]) =>
      apiFetch<LayoutResponse>(`/boards/${boardId}/default-layout`, {
        method: "PUT",
        body: { layout },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layout", boardId] });
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      toast.success("Default layout saved for the board");
    },
    onError: showError,
  });
}
