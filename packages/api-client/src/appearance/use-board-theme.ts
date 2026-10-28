"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notify } from "../client";
import { resolveBoardTheme, type BoardTheme } from "@artist/shared";
import { apiFetch } from "../client";
import { toUserMessage } from "../messages";
import { useMe } from "../auth/use-me";
import type { BoardDetailDto, MeResponse } from "../auth/types";

const showError = (error: unknown) =>
  notify.error(
    toUserMessage(error, "Couldn't save appearance"),
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
    // Optimistic: recoloring a card should feel instant, so patch the cache
    // before the round-trip and roll back to the snapshot if the save fails.
    // Both copies: web paints from `/me`, the phone from the board itself.
    // `/me` carries one board only, so it is patched only if it is this one.
    onMutate: (theme) => {
      const previousMe = queryClient.getQueryData<MeResponse>(["me"]);
      const previousBoard = queryClient.getQueryData<BoardDetailDto>(["board", boardId]);
      queryClient.setQueryData<MeResponse>(["me"], (current) =>
        current?.board?.id === boardId
          ? { ...current, board: { ...current.board, theme } }
          : current,
      );
      queryClient.setQueryData<BoardDetailDto>(["board", boardId], (current) =>
        current ? { ...current, theme } : current,
      );
      return { previousMe, previousBoard };
    },
    onError: (error, _theme, context) => {
      if (context?.previousMe) queryClient.setQueryData(["me"], context.previousMe);
      if (context?.previousBoard) {
        queryClient.setQueryData(["board", boardId], context.previousBoard);
      }
      showError(error);
    },
    onSuccess: () => {
      // GET /boards/:id carries the theme too — keep the settings page honest.
      queryClient.invalidateQueries({ queryKey: ["board", boardId] });
      // So does each band's palette on `me.boards`, which colours the phone's
      // band dots and filter chips.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
