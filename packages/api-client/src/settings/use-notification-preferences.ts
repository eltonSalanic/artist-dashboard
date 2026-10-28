"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NotificationCategory,
  NotificationPreferencesDto,
} from "@artist/shared";
import { apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";

/** Personal, per board: what this board may email *you* about. */
export function useNotificationPreferences(boardId: string) {
  return useQuery({
    queryKey: ["notification-preferences", boardId],
    queryFn: () =>
      apiFetch<NotificationPreferencesDto>(
        `/boards/${boardId}/notification-preferences`,
      ),
  });
}

export function useSaveNotificationPreference(boardId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["notification-preferences", boardId];

  return useMutation({
    mutationFn: (input: { category: NotificationCategory; enabled: boolean }) =>
      apiFetch<NotificationPreferencesDto>(
        `/boards/${boardId}/notification-preferences`,
        { method: "PUT", body: input },
      ),
    // A toggle that lags behind the thumb feels broken, so paint it first and
    // put it back if the save fails.
    onMutate: ({ category, enabled }) => {
      const previous =
        queryClient.getQueryData<NotificationPreferencesDto>(queryKey);
      queryClient.setQueryData<NotificationPreferencesDto>(
        queryKey,
        (current) => current && { ...current, [category]: enabled },
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      notify.error(toUserMessage(error, "Couldn't save that"));
    },
    onSuccess: (fresh) => queryClient.setQueryData(queryKey, fresh),
  });
}
