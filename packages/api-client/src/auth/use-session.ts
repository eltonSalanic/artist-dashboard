"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

/**
 * The slice of `supabase.auth` this hook needs, declared structurally so the
 * package depends on Supabase for *types only*. Both apps pass their own
 * `supabase.auth`: web's is backed by `localStorage`, mobile's by
 * `expo-secure-store`.
 */
export interface SessionSource {
  getSession(): Promise<{ data: { session: Session | null } }>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } };
}

export interface SessionState {
  session: Session | null;
  /** True until the stored session has been read. Never route on it before. */
  loading: boolean;
}

let source: SessionSource | null = null;

/**
 * Module-level like `configureApiClient`, and for the same reason: the hook
 * keeps the call signature it had in `apps/web`, so moving it here stayed a
 * behaviour-neutral refactor instead of threading a client through every
 * caller.
 */
export function configureSessionSource(next: SessionSource): void {
  source = next;
}

/** Test seam — lets a suite start from a known-unconfigured state. */
export function resetSessionSource(): void {
  source = null;
}

function requireSource(): SessionSource {
  if (!source) {
    throw new Error(
      "configureSessionSource() must be called before useSession()",
    );
  }
  return source;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    const auth = requireSource();
    let mounted = true;
    // Once any auth event has been handled, the one-shot read is stale by
    // definition. On native the stored session comes out of the keychain in
    // several reads, so `getSession()` can resolve *after* a sign-in event —
    // letting it win would clear a session that had just arrived.
    let sawEvent = false;

    void auth.getSession().then(({ data }) => {
      if (mounted && !sawEvent) {
        setState({ session: data.session, loading: false });
      }
    });
    const {
      data: { subscription },
    } = auth.onAuthStateChange((_event, session) => {
      sawEvent = true;
      if (mounted) setState({ session, loading: false });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
