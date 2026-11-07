"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFinanceEntryDto,
  FinanceEntryDto,
  FinanceEntryQueryDto,
  FinanceSummaryDto,
  FinanceSummaryQueryDto,
  ShowSettlementDto,
  UpdateFinanceEntryDto,
} from "@artist/shared";
import { apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";

const showError = (error: unknown) =>
  notify.error(toUserMessage(error));

const base = (boardId: string) => `/boards/${boardId}/finances`;

const query = (params: Record<string, string | boolean | undefined>) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const text = qs.toString();
  return text ? `?${text}` : "";
};

/**
 * Every money view hangs off one prefix: an entry changes the ledger, the
 * totals, the balances and the show it belongs to all at once, so they move
 * together. Activity too — logging money writes a feed row.
 */
function useInvalidateFinances(boardId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["finances", boardId] }),
      queryClient.invalidateQueries({ queryKey: ["activity", boardId] }),
      // "Owed back" reminders and "paid back" alerts live in the inbox.
      queryClient.invalidateQueries({ queryKey: ["inbox"] }),
      queryClient.invalidateQueries({ queryKey: ["mentions"] }),
    ]);
}

export function useFinanceEntries(
  boardId: string,
  filters: Partial<FinanceEntryQueryDto> = {},
) {
  return useQuery({
    queryKey: ["finances", boardId, "entries", filters],
    queryFn: () =>
      apiFetch<FinanceEntryDto[]>(
        `${base(boardId)}/entries${query({ ...filters })}`,
      ),
  });
}

export function useFinanceEntry(boardId: string, entryId: string | null) {
  return useQuery({
    queryKey: ["finances", boardId, "entry", entryId],
    queryFn: () =>
      apiFetch<FinanceEntryDto>(`${base(boardId)}/entries/${entryId}`),
    enabled: !!entryId,
  });
}

export function useFinanceSummary(
  boardId: string,
  range: FinanceSummaryQueryDto = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ["finances", boardId, "summary", range],
    queryFn: () =>
      apiFetch<FinanceSummaryDto>(`${base(boardId)}/summary${query(range)}`),
    enabled,
  });
}

export function useShowSettlement(boardId: string, eventId: string | null) {
  return useQuery({
    queryKey: ["finances", boardId, "show", eventId],
    queryFn: () =>
      apiFetch<ShowSettlementDto>(`${base(boardId)}/shows/${eventId}`),
    enabled: !!eventId,
  });
}

export function useCreateFinanceEntry(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (dto: CreateFinanceEntryDto) =>
      apiFetch<FinanceEntryDto>(`${base(boardId)}/entries`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useUpdateFinanceEntry(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: ({
      entryId,
      dto,
    }: {
      entryId: string;
      dto: UpdateFinanceEntryDto;
    }) =>
      apiFetch<FinanceEntryDto>(`${base(boardId)}/entries/${entryId}`, {
        method: "PATCH",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

/**
 * An admin pays a member back for an out-of-pocket expense, from the band
 * fund. The entry locks until the payback is undone.
 */
export function usePayBackFinanceEntry(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (entryId: string) =>
      apiFetch<FinanceEntryDto>(
        `${base(boardId)}/entries/${entryId}/pay-back`,
        { method: "POST" },
      ),
    onSuccess: invalidate,
    onError: showError,
  });
}

/** Takes a payback back: the member is owed again, and it can be edited. */
export function useUndoPayBackFinanceEntry(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (entryId: string) =>
      apiFetch<FinanceEntryDto>(
        `${base(boardId)}/entries/${entryId}/undo-pay-back`,
        { method: "POST" },
      ),
    onSuccess: invalidate,
    onError: showError,
  });
}

/** Pays a member back for everything the band still owes them. */
export function usePayBackMember(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<FinanceEntryDto[]>(
        `${base(boardId)}/members/${userId}/pay-back`,
        { method: "POST" },
      ),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useVoidFinanceEntry(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (entryId: string) =>
      apiFetch<FinanceEntryDto>(`${base(boardId)}/entries/${entryId}/void`, {
        method: "POST",
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}
