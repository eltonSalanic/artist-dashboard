"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateFinanceEntryDto,
  CreatePayoutDto,
  FinanceEntryDto,
  FinanceEntryQueryDto,
  FinanceSplitDto,
  FinanceSummaryDto,
  FinanceSummaryQueryDto,
  PayoutDto,
  SettleShowDto,
  ShowSettlementDto,
  UpdateFinanceEntryDto,
  UpdateFinanceSettingsDto,
  UpdateSplitDto,
} from "@artist/shared";
import { apiFetch, ApiError, notify } from "../client";

const showError = (error: unknown) =>
  notify.error(error instanceof ApiError ? error.message : "Something went wrong");

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

export function useFinanceSplit(boardId: string) {
  return useQuery({
    queryKey: ["finances", boardId, "split"],
    queryFn: () => apiFetch<FinanceSplitDto>(`${base(boardId)}/split`),
  });
}

export function usePayouts(boardId: string) {
  return useQuery({
    queryKey: ["finances", boardId, "payouts"],
    queryFn: () => apiFetch<PayoutDto[]>(`${base(boardId)}/payouts`),
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

export function useUpdateFinanceSplit(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (dto: UpdateSplitDto) =>
      apiFetch<FinanceSplitDto>(`${base(boardId)}/split`, {
        method: "PUT",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useUpdateFinanceSettings(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (dto: UpdateFinanceSettingsDto) =>
      apiFetch<{ currency: string }>(`${base(boardId)}/settings`, {
        method: "PUT",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useCreatePayout(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (dto: CreatePayoutDto) =>
      apiFetch<PayoutDto>(`${base(boardId)}/payouts`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useDeletePayout(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: (payoutId: string) =>
      apiFetch(`${base(boardId)}/payouts/${payoutId}`, { method: "DELETE" }),
    onSuccess: invalidate,
    onError: showError,
  });
}

export function useSettleShow(boardId: string) {
  const invalidate = useInvalidateFinances(boardId);
  return useMutation({
    mutationFn: ({ eventId, dto }: { eventId: string; dto: SettleShowDto }) =>
      apiFetch<ShowSettlementDto>(`${base(boardId)}/shows/${eventId}/settle`, {
        method: "POST",
        body: dto,
      }),
    onSuccess: invalidate,
    onError: showError,
  });
}
