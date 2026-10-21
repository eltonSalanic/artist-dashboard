"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NoteDto, NoteParentKind, UpdateNoteDto } from "@artist/shared";
import { apiFetch, ApiError, notify } from "../client";

const showError = (error: unknown) =>
  notify.error(error instanceof ApiError ? error.message : "Something went wrong");

export const notesKey = (boardId: string, kind: NoteParentKind, parentId: string) =>
  ["notes", boardId, kind, parentId] as const;

/**
 * The titled notes on one task, event, goal or reminder, plus add / edit /
 * delete. Every write refetches the list (it is small and only one screen
 * shows it).
 */
export function useNotes(boardId: string, kind: NoteParentKind, parentId: string) {
  const queryClient = useQueryClient();
  const key = notesKey(boardId, kind, parentId);
  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<NoteDto[]>(
        `/boards/${boardId}/notes?kind=${kind}&parentId=${parentId}`,
      ),
    enabled: !!boardId && !!parentId,
  });
  const refetch = () => queryClient.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: (dto: { title: string; body: string }) =>
      apiFetch<NoteDto>(`/boards/${boardId}/notes`, {
        method: "POST",
        body: { kind, parentId, ...dto },
      }),
    onSuccess: refetch,
    onError: showError,
  });
  const update = useMutation({
    mutationFn: ({ noteId, dto }: { noteId: string; dto: UpdateNoteDto }) =>
      apiFetch<NoteDto>(`/boards/${boardId}/notes/${noteId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: refetch,
    onError: showError,
  });
  const remove = useMutation({
    mutationFn: (noteId: string) =>
      apiFetch(`/boards/${boardId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: refetch,
    onError: showError,
  });

  return { ...query, add, update, remove };
}
