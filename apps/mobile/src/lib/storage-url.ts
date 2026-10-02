/**
 * Points a signed Storage URL at a host the phone can reach.
 *
 * The API signs URLs with *its* Supabase URL. In local development that is
 * `127.0.0.1:54321` — which, on a phone, is the phone. The signature is a
 * token in the query string, not bound to the host, so swapping the origin for
 * the LAN address the app already uses for Supabase keeps it valid.
 *
 * Only loopback origins are rewritten: a deployed API signs with the public
 * project URL, which needs nothing, and rewriting that would be wrong.
 *
 * Pure, with the reachable origin passed in, so it can be tested without the
 * bundle-time env. String surgery rather than `URL` setters, which React
 * Native's `URL` does not reliably implement — a failure that would only show
 * up on a device.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);
const ORIGIN = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]+)(.*)$/i;

export function reachableStorageUrl(signedUrl: string, supabaseUrl: string): string {
  const signed = ORIGIN.exec(signedUrl);
  const reachable = ORIGIN.exec(supabaseUrl);
  if (!signed || !reachable) return signedUrl;

  const [, , authority, rest] = signed;
  // Drop any port; a bracketed IPv6 host keeps its brackets.
  const hostname = authority.replace(/:\d+$/, '');
  if (!LOOPBACK.has(hostname)) return signedUrl;

  return `${reachable[1]}${reachable[2]}${rest}`;
}
