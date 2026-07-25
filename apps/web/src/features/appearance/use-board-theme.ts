"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resolveBoardTheme, type BoardTheme } from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import { useMe } from "@/features/auth/use-me";
import type { MeResponse } from "@/features/auth/types";

const showError = (error: unknown) =>
  toast.error(
    error instanceof ApiError ? error.message : "Couldn't save appearance",
  );

/**
 * The board's palette and widget colors. Read off `/me`, which already carries
 * the board, so painting the dashboard costs no extra request.
 */
export function useBoardTheme(): BoardTheme {
  const me = useMe(true);
  return resolveBoardTheme(me.data?.board?.theme);
}

export function useSaveBoardTheme(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (theme: BoardTheme) =>
      apiFetch<{ id: string; theme: BoardTheme }>(`/boards/${boardId}/theme`, {
        method: "PUT",
        body: theme,
      }),
    // Optimistic: recoloring a card should feel instant, so patch `/me` before
    // the round-trip and roll back to the snapshot if the save fails.
    onMutate: (theme) => {
      const previous = queryClient.getQueryData<MeResponse>(["me"]);
      queryClient.setQueryData<MeResponse>(["me"], (current) =>
        current?.board ? { ...current, board: { ...current.board, theme } } : current,
      );
      return { previous };
    },
    onError: (error, _theme, context) => {
      if (context?.previous) queryClient.setQueryData(["me"], context.previous);
      showError(error);
    },
    onSuccess: () => {
      // GET /boards/:id carries the theme too — keep the settings page honest.
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
    },
  });
}
