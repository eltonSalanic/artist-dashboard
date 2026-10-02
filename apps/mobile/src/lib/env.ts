/**
 * Runtime configuration.
 *
 * `EXPO_PUBLIC_*` variables are **inlined by Babel at bundle time**, so every
 * one has to be referenced by its literal name — `process.env[name]` reads
 * nothing. That is why this file repeats itself rather than looping.
 *
 * All three are public by nature (they ship inside the bundle): the API URL,
 * the Supabase project URL, and the Supabase *anon* key, which is the same key
 * the web app embeds. Server-only secrets never appear here.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy apps/mobile/.env.example to apps/mobile/.env and ` +
        `fill it in — a phone cannot reach localhost, so these must be your ` +
        `machine's LAN address.`,
    );
  }
  return value;
}

/** `apiFetch` concatenates paths onto the base URL, so a trailing slash would double up. */
function origin(name: string, value: string | undefined): string {
  return required(name, value).replace(/\/+$/, '');
}

export const env = {
  /** Origin of the NestJS API, no trailing slash. */
  apiUrl: origin('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  supabaseUrl: origin(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
} as const;
