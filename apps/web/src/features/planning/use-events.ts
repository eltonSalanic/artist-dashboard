"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  CreateEventDto,
  EventType,
  UpdateEventDto,
} from "@artist/shared";
import { apiFetch, ApiError } from "@/lib/api";
import type { EventDto } from "./types";

const showError = (error: unknown) =>
  toast.error(error instanceof ApiError ? error.message : "Something went wrong");

export interface EventFilters {
  type?: EventType;
  /** ISO instant — only events starting at/after this. */
  from?: string;
  /** ISO instant — only events starting before this. */
  to?: string;
  limit?: number;
}

export function useEvents(boardId: string, filters: EventFilters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return useQuery({
    queryKey: ["events", boardId, filters],
    queryFn: () =>
      apiFetch<EventDto[]>(`/boards/${boardId}/events${qs ? `?${qs}` : ""}`),
  });
}

export function useEvent(boardId: string, eventId: string | null) {
  return useQuery({
    queryKey: ["event", boardId, eventId],
    queryFn: () => apiFetch<EventDto>(`/boards/${boardId}/events/${eventId}`),
    enabled: !!eventId,
  });
}

function useInvalidateEvents(boardId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["events", boardId] });
    queryClient.invalidateQueries({ queryKey: ["event", boardId] });
    queryClient.invalidateQueries({ queryKey: ["calendar", boardId] });
  };
}

export function useCreateEvent(boardId: string) {
  const invalidate = useInvalidateEvents(boardId);
  return useMutation({
    mutationFn: (dto: CreateEventDto) =>
      apiFetch<EventDto>(`/boards/${boardId}/events`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useUpdateEvent(boardId: string) {
  const invalidate = useInvalidateEvents(boardId);
  return useMutation({
    mutationFn: ({ eventId, dto }: { eventId: string; dto: UpdateEventDto }) =>
      apiFetch<EventDto>(`/boards/${boardId}/events/${eventId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useDeleteEvent(boardId: string) {
  const invalidate = useInvalidateEvents(boardId);
  return useMutation({
    mutationFn: (eventId: string) =>
      apiFetch(`/boards/${boardId}/events/${eventId}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: showError,
  });
}
