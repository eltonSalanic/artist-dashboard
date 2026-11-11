import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BoardRole } from '@artist/shared';
import { reportError } from '@/lib/report-error';

/**
 * Per band and per role, so someone made an admin later is told once what
 * that changed.
 */
const seenKey = (boardId: string, role: BoardRole) => `artist.help.roleIntro.${boardId}.${role}`;

/**
 * Whether the hub should show this band's "how this band works" card: once
 * per band on this phone, until the person closes it. Starts hidden so the
 * card never flashes for someone who closed it already.
 */
export function useRoleIntro(boardId: string, role: BoardRole) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let current = true;
    AsyncStorage.getItem(seenKey(boardId, role))
      .then((seen) => {
        if (current) setVisible(seen !== '1');
      })
      .catch(() => {
        // Unreadable storage: leave the card off rather than show it forever.
      });
    return () => {
      current = false;
    };
  }, [boardId, role]);

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(seenKey(boardId, role), '1').catch((error: unknown) =>
      reportError(error, { where: 'help.dismissRoleIntro' }),
    );
  }, [boardId, role]);

  return { visible, dismiss };
}
