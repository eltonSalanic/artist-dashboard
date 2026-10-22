/**
 * The laptop's address as the phone sees it, taken from the Metro URL the dev
 * build was opened with ("172.20.10.2:8081"). Expo picks that address afresh
 * each `expo start`, so the API and Supabase follow it onto whatever network
 * you are on — home Wi-Fi, a hotspot — without editing `.env`.
 *
 * Returns undefined when there is no Metro host (a release build).
 */
export function urlOnDevHost(hostUri: string | undefined, port: number): string | undefined {
  if (!hostUri) return undefined;
  // Drop the port; an IPv6 host keeps its brackets.
  const host = hostUri.replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  return host ? `http://${host}:${port}` : undefined;
}
