/**
 * Calls `onChange` only when the token is one it has not seen.
 *
 * Exists because of a loop that flooded the API on the first device build:
 * asking Expo for a push token makes iOS report the device token again, which
 * fires `addPushTokenListener` — so a listener that simply re-registered asked
 * for a token, which fired the listener, about fifty times a second. The token
 * had not changed; only a *different* one is worth telling the API about.
 *
 * Pure, so the guard is tested without a phone.
 */
export function onTokenChange(
  onChange: (token: string) => void,
): (token: string) => void {
  let last: string | null = null;
  return (token) => {
    if (token === last) return;
    last = token;
    onChange(token);
  };
}

/**
 * Wraps an async job so overlapping calls share the run already in flight
 * rather than starting another — registration is idempotent, but a burst of
 * identical requests is still a burst.
 */
export function single<T>(job: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  return () => {
    running ??= job().finally(() => {
      running = null;
    });
    return running;
  };
}
