import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Refetches stale data when the user comes back to this screen.
 *
 * A screen stays mounted under whatever is pushed on top of it, so returning
 * to it neither remounts nor refetches. Without this, a show archived on web
 * stays on the hub's Shows card after a trip to the Archive and back, until a
 * pull-to-refresh. Web gets the same refresh on window focus for free.
 *
 * Only stale queries go (`staleTime` is 30s), so bouncing between screens does
 * not hammer the API. The first focus is skipped: mounting just fetched.
 */
export function useRefetchOnFocus(): void {
  const queryClient = useQueryClient();
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void queryClient.refetchQueries({ type: 'active', stale: true });
    }, [queryClient]),
  );
}
