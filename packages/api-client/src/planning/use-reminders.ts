"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "../client";
import type { CreateReminderDto, UpdateReminderDto } from "@artist/shared";
import { apiFetch } from "../client";
import { INLINE_ERROR, toUserMessage } from "../messages";
import type { ReminderDto } from "./types";

const showError = (error: unknown) =>
  notify.error(toUserMessage(error));

export function useReminders(boardId: string) {
  return useQuery({
    queryKey: ["reminders", boardId],
    queryFn: () => apiFetch<ReminderDto[]>(`/boards/${boardId}/reminders`),
  });
}

export function useReminder(boardId: string, reminderId: string | null) {
  return useQuery({
    meta: INLINE_ERROR,
    queryKey: ["reminder", boardId, reminderId],
    queryFn: () =>
      apiFetch<ReminderDto>(`/boards/${boardId}/reminders/${reminderId}`),
    enabled: !!reminderId,
  });
}

/**
 * Returned as a promise, and returned from `onSuccess`, so a mutation stays
 * pending until fresh data has landed — what lets a client show a tick
 * optimistically without it flickering back.
 *
 * Every calendar query, not just this board's: the phone's Calendar tab reads
 * the cross-board key (`["calendar", "all", …]`), which a board-scoped prefix
 * does not match.
 */
function useInvalidateReminders(boardId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["reminders", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["reminder", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      // A reminder can be deleted from the archive page, so that list moves too.
      queryClient.invalidateQueries({ queryKey: ["archive", boardId] }),
    ]);
}

export function useCreateReminder(boardId: string) {
  const invalidate = useInvalidateReminders(boardId);
  return useMutation({
    mutationFn: (dto: CreateReminderDto) =>
      apiFetch<ReminderDto>(`/boards/${boardId}/reminders`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useUpdateReminder(boardId: string) {
  const invalidate = useInvalidateReminders(boardId);
  return useMutation({
    mutationFn: ({
      reminderId,
      dto,
    }: {
      reminderId: string;
      dto: UpdateReminderDto;
    }) =>
      apiFetch<ReminderDto>(`/boards/${boardId}/reminders/${reminderId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useDeleteReminder(boardId: string) {
  const invalidate = useInvalidateReminders(boardId);
  return useMutation({
    mutationFn: (reminderId: string) =>
      apiFetch(`/boards/${boardId}/reminders/${reminderId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}
