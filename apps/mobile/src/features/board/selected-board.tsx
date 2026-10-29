import { createContext, use, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BoardRole, BoardSummaryDto } from '@artist/shared';
import { reportError } from '@/lib/report-error';

/**
 * Which board the app is currently showing.
 *
 * "You land in your last-opened board" is a design decision, which means the
 * choice has to outlive the process — otherwise reopening the app always drops
 * you back on whichever board happens to be first. `AsyncStorage` rather than
 * the keychain: a board id is a preference, not a secret, and `SecureStore`
 * pays a keychain round-trip for it.
 *
 * The stored id is **validated against live membership** on every load. Someone
 * removed from a band keeps the id on their phone, and trusting it would leave
 * the app asking for a board the API will refuse.
 */
const STORAGE_KEY = 'artist.selectedBoardId';

export interface SelectedBoard {
  /** Null while loading, or when the caller belongs to no boards. */
  board: BoardSummaryDto | null;
  /** Role on *this* board. There is no global role — see P3 in the plan. */
  role: BoardRole | null;
  boards: BoardSummaryDto[];
  /** True until the stored choice has been read. */
  loading: boolean;
  select: (boardId: string) => void;
}

const SelectedBoardContext = createContext<SelectedBoard | null>(null);

export function SelectedBoardProvider({
  boards,
  children,
}: {
  boards: BoardSummaryDto[];
  children: ReactNode;
}) {
  const [storedId, setStoredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (mounted) {
          setStoredId(value);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        // A failed read is a missing preference, not an error worth surfacing
        // to the user: falling back to the first board is exactly the
        // first-run behaviour. It still goes to the reporter.
        reportError(error, { where: 'selectedBoard' });
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const select = useCallback((boardId: string) => {
    setStoredId(boardId);
    void AsyncStorage.setItem(STORAGE_KEY, boardId).catch(() => {
      // The choice still applies for this session; only the memory is lost.
    });
  }, []);

  const board =
    boards.find((candidate) => candidate.id === storedId) ?? boards[0] ?? null;

  return (
    <SelectedBoardContext.Provider
      value={{
        board,
        role: board?.role ?? null,
        boards,
        loading,
        select,
      }}
    >
      {children}
    </SelectedBoardContext.Provider>
  );
}

export function useSelectedBoard(): SelectedBoard {
  const value = use(SelectedBoardContext);
  if (!value) {
    throw new Error('useSelectedBoard() must be used inside the tab layout');
  }
  return value;
}
