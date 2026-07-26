"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateReminderDto, UpdateReminderDto } from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import type { ReminderDto } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

export function useReminders(boardId: string) {
  return useQuery({
    queryKey: ["reminders", boardId],
    queryFn: () => apiFetch<ReminderDto[]>(`/boards/${boardId}/reminders`),
  });
}

export function useReminder(boardId: string, reminderId: string | null) {
  return useQuery({
    queryKey: ["reminder", boardId, reminderId],
    queryFn: () =>
      apiFetch<ReminderDto>(`/boards/${boardId}/reminders/${reminderId}`),
    enabled: !!reminderId,
  });
}

function useInvalidateReminders(boardId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["reminders", boardId] });
    queryClient.invalidateQueries({ queryKey: ["reminder", boardId] });
    queryClient.invalidateQueries({ queryKey: ["calendar", boardId] });
    // A reminder can be deleted from the archive page, so that list moves too.
    queryClient.invalidateQueries({ queryKey: ["archive", boardId] });
  };
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
