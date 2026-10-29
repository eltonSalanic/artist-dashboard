"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateInviteDto } from "@artist/shared";
import { apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";
import type { InviteDto } from "../auth/types";

/** What `POST /invites` adds: whether an email went out or they will just join. */
export type SentInviteDto = InviteDto & { delivery: string };

const showError = (fallback: string) => (error: unknown) =>
  notify.error(toUserMessage(error, fallback));

export function useInvites(boardId: string) {
  return useQuery({
    queryKey: ["invites", boardId],
    queryFn: () => apiFetch<InviteDto[]>(`/boards/${boardId}/invites`),
  });
}

export function useSendInvite(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateInviteDto) =>
      apiFetch<SentInviteDto>(`/boards/${boardId}/invites`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: (invite) => {
      void queryClient.invalidateQueries({ queryKey: ["invites", boardId] });
      // Someone who already has an account gets no email — they join on their
      // next sign-in — so the confirmation has to say which happened.
      notify.success(
        invite.delivery === "already_registered"
          ? "Invite saved. They'll join next time they sign in"
          : "Invite email sent",
      );
    },
    onError: showError("Invite failed"),
  });
}

export function useRevokeInvite(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch(`/boards/${boardId}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["invites", boardId] }),
    onError: showError("Couldn't revoke that invite"),
  });
}
