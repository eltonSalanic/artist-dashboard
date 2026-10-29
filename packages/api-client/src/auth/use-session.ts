"use client";

import { useEffect, useState } from "react";
import { getAuthClient, type AuthSession } from "./auth-client";

export interface SessionState {
  session: AuthSession | null;
  /** True until the stored session has been read. Never route on it before. */
  loading: boolean;
}

/**
 * The signed-in session, from whichever `AuthClient` the app configured.
 * Keeps the call signature it had in `apps/web`, so callers never thread a
 * client through.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    const auth = getAuthClient();
    let mounted = true;
    // Once any auth event has been handled, the one-shot read is stale by
    // definition. On native the stored session comes out of the keychain in
    // several reads, so `getSession()` can resolve *after* a sign-in event —
    // letting it win would clear a session that had just arrived.
    let sawEvent = false;

    void auth.getSession().then((session) => {
      if (mounted && !sawEvent) setState({ session, loading: false });
    });
    const unsubscribe = auth.onSessionChange((session) => {
      sawEvent = true;
      if (mounted) setState({ session, loading: false });
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
