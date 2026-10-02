import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BoardSummaryDto } from '@artist/shared';
import { scopeFromStored, type BoardScopeTab } from './board-scope';
import { useSelectedBoard } from '@/features/board/selected-board';

const storageKey = (tab: BoardScopeTab) => `artist.boardScope.${tab}`;

export interface BoardScope {
  /** `undefined` means every band — the filter's "All". */
  boardId: string | undefined;
  select: (boardId: string | undefined) => void;
  boards: BoardSummaryDto[];
  /**
   * False until the stored choice has been read. Queries wait on it: firing
   * unfiltered first would show every band for a moment, then snap to one.
   */
  ready: boolean;
}

/**
 * Which band a cross-board tab is filtered to, remembered between launches.
 *
 * Sticky for the same reason the selected board is: someone who only ever wants
 * one band's calendar should not re-pick it on every launch. `AsyncStorage`
 * rather than the keychain, because a board id is a preference, not a secret.
 * Per tab rather than global — see `BoardScopeTab`.
 */
export function useBoardScope(tab: BoardScopeTab): BoardScope {
  const { boards } = useSelectedBoard();
  const [storedId, setStoredId] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey(tab))
      .then((value) => {
        if (!mounted) return;
        setStoredId(value ?? undefined);
        setReady(true);
      })
      .catch(() => {
        // A failed read is an absent preference, and "all bands" is exactly the
        // first-run state — nothing here is worth an error message.
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [tab]);

  const select = useCallback(
    (boardId: string | undefined) => {
      setStoredId(boardId);
      const key = storageKey(tab);
      void (boardId === undefined
        ? AsyncStorage.removeItem(key)
        : AsyncStorage.setItem(key, boardId)
      ).catch(() => {
        // The filter still applies for this session; only the memory is lost.
      });
    },
    [tab],
  );

  return {
    boardId: scopeFromStored(storedId, boards),
    select,
    boards,
    ready,
  };
}
