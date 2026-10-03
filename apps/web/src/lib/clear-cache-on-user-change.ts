import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

interface AuthEvents {
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } };
}

/**
 * Empties the query cache whenever the signed-in user changes: sign-out, or
 * signing in as someone else. Signing in and out navigate without reloading
 * the page, so the cache outlives the session, and `["me"]` never goes stale
 * on its own. Without this, the next person to sign in in this tab sees the
 * previous person's account until a reload.
 *
 * Token refreshes keep the same user and leave the cache alone.
 */
export function clearCacheOnUserChange(
  auth: AuthEvents,
  cache: { clear(): void },
): () => void {
  // `undefined` until the first event says who is signed in at page load.
  let userId: string | null | undefined;
  const {
    data: { subscription },
  } = auth.onAuthStateChange((_event, session) => {
    const next = session?.user.id ?? null;
    if (userId !== undefined && next !== userId) cache.clear();
    userId = next;
  });
  return () => subscription.unsubscribe();
}
