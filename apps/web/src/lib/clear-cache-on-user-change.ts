import type { AuthClient } from "@artist/api-client";

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
  auth: Pick<AuthClient, "onSessionChange">,
  cache: { clear(): void },
): () => void {
  // `undefined` until the first event says who is signed in at page load.
  let userId: string | null | undefined;
  return auth.onSessionChange((session) => {
    const next = session?.userId ?? null;
    if (userId !== undefined && next !== userId) cache.clear();
    userId = next;
  });
}
