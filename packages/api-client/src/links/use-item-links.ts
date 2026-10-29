"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ItemLinkDto,
  ItemLinkInputDto,
  LinkParentKind,
} from "@artist/shared";
import { apiFetch, notify } from "../client";
import { toUserMessage } from "../messages";

export function useItemLinks(
  boardId: string,
  kind: LinkParentKind,
  parentId: string,
) {
  const queryClient = useQueryClient();
  const key = ["item-links", boardId, kind, parentId] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      apiFetch<ItemLinkDto[]>(
        `/boards/${boardId}/links?kind=${kind}&parentId=${parentId}`,
      ),
    enabled: !!boardId && !!parentId,
  });
  const refetch = () => queryClient.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: (dto: ItemLinkInputDto) =>
      apiFetch<ItemLinkDto>(`/boards/${boardId}/links`, {
        method: "POST",
        body: { ...dto, kind, parentId },
      }),
    onSuccess: refetch,
  });
  const remove = useMutation({
    mutationFn: (linkId: string) =>
      apiFetch(`/boards/${boardId}/links/${linkId}`, { method: "DELETE" }),
    onSuccess: refetch,
    onError: (error: unknown) =>
      notify.error(
        toUserMessage(error, "Could not remove the link"),
      ),
  });
  return { ...query, add, remove };
}
