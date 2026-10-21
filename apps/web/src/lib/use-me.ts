"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useMe as useBootstrap } from "@artist/api-client";
import type { MeResponse } from "@artist/api-client";

const KEY = "band-wall.selected-board";
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab switching band moves this one too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Which band the person last picked here; null until they pick one. */
export function useSelectedBoardId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function selectBoard(boardId: string) {
  try {
    window.localStorage.setItem(KEY, boardId);
  } catch {
    // Private windows: the pick lasts until reload, which is acceptable.
  }
  listeners.forEach((listener) => listener());
}

/**
 * `useMe`, with `board` and `membership` describing the band the person picked
 * instead of always the first one. Web only ever reads the board's id and name
 * and the membership's role, so those are what is swapped; the rest of `board`
 * (default layout, theme) still describes the first band and must be fetched
 * with `useBoard(id)` if it is ever needed.
 *
 * A stored pick for a band the person has since left falls back to the first.
 */
export function useMe(enabled: boolean) {
  const query = useBootstrap(enabled);
  const picked = useSelectedBoardId();

  const data = useMemo<MeResponse | undefined>(() => {
    const me = query.data;
    if (!me || !me.board) return me;
    const chosen = me.boards.find((board) => board.id === picked) ?? me.boards[0];
    if (!chosen) return me;
    return {
      ...me,
      board: { ...me.board, id: chosen.id, name: chosen.name },
      membership: { id: chosen.membershipId, role: chosen.role },
    };
  }, [query.data, picked]);

  return { ...query, data };
}
