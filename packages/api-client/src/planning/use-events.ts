"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notify } from "../client";
import type {
  ChangeShowStatusDto,
  CreateEventDto,
  EventType,
  UpdateEventDto,
} from "@artist/shared";
import { apiFetch, ApiError } from "../client";
import type { EventDto } from "./types";

const showError = (error: unknown) =>
  notify.error(error instanceof ApiError ? error.message : "Something went wrong");

export interface EventFilters {
  type?: EventType;
  /** ISO instant — only events starting at/after this. */
  from?: string;
  /** ISO instant — only events starting before this. */
  to?: string;
  limit?: number;
  showStatusId?: string;
  /** Cancelled shows are left out unless this is set. */
  includeCancelled?: boolean;
}

export function useEvents(boardId: string, filters: EventFilters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.showStatusId) params.set("showStatusId", filters.showStatusId);
  if (filters.includeCancelled) params.set("includeCancelled", "true");
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

/**
 * Returned as a promise, and returned from `onSuccess`, so a mutation stays
 * pending until fresh data has landed — what lets a client show a tick
 * optimistically without it flickering back.
 *
 * Every calendar query, not just this board's: the phone's Calendar tab reads
 * the cross-board key (`["calendar", "all", …]`), which a board-scoped prefix
 * does not match.
 */
function useInvalidateEvents(boardId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["events", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["event", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      // A event can be deleted from the archive page, so that list moves too.
      queryClient.invalidateQueries({ queryKey: ["archive", boardId] }),
    ]);
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
    mutationFn: ({
      eventId,
      cascadeTasks = false,
    }: {
      eventId: string;
      /** Delete the tasks linked to this event along with it. */
      cascadeTasks?: boolean;
    }) =>
      apiFetch(
        `/boards/${boardId}/events/${eventId}?cascadeTasks=${cascadeTasks}`,
        { method: "DELETE" },
      ),
    onSuccess: invalidate,
    onError: showError,
  });
}

/**
 * Move a show to another status. Open to members, unlike `useUpdateEvent`.
 * The response carries `expectedIncomeCents` after a cancellation, so the
 * caller can point at money still expected for the show.
 */
export function useChangeShowStatus(boardId: string) {
  const invalidate = useInvalidateEvents(boardId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      dto,
    }: {
      eventId: string;
      dto: ChangeShowStatusDto;
    }) =>
      apiFetch<EventDto & { expectedIncomeCents: number }>(
        `/boards/${boardId}/events/${eventId}/status`,
        { method: "PATCH", body: dto },
      ),
    onSuccess: () =>
      Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: ["activity", boardId] }),
      ]),
    onError: showError,
  });
}
