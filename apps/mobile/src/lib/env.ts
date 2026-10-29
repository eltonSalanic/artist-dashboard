/**
 * Runtime configuration.
 *
 * `EXPO_PUBLIC_*` variables are **inlined by Babel at bundle time**, so every
 * one has to be referenced by its literal name — `process.env[name]` reads
 * nothing. That is why this file repeats itself rather than looping.
 *
 * Both are public by nature (they ship inside the bundle): the API URL, and the
 * Supabase project URL, which only rewrites signed file links so a phone can
 * reach local Storage. Server-only secrets never appear here.
 */

import Constants from 'expo-constants';
import { parseAppEnv } from '@artist/shared';
import { urlOnDevHost } from './dev-host';

/** The ports `npm run dev` and `npx supabase start` listen on. */
const API_PORT = 3001;
const SUPABASE_PORT = 54321;
const metroHost = __DEV__ ? Constants.expoConfig?.hostUri : undefined;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy apps/mobile/.env.example to apps/mobile/.env and ` +
        `fill it in — a phone cannot reach localhost, so these must be your ` +
        `machine's LAN address (in a dev build they default to Metro's).`,
    );
  }
  return value;
}

/** `apiFetch` concatenates paths onto the base URL, so a trailing slash would double up. */
function origin(name: string, value: string | undefined): string {
  return required(name, value).replace(/\/+$/, '');
}

/**
 * A URL set in `.env` (or by `tunnel.sh`) wins. Left out, a dev build points at
 * the machine serving Metro, so changing networks needs only a fresh scan.
 */
export const env = {
  /** Origin of the NestJS API, no trailing slash. */
  apiUrl: origin(
    'EXPO_PUBLIC_API_URL',
    process.env.EXPO_PUBLIC_API_URL || urlOnDevHost(metroHost, API_PORT),
  ),
  supabaseUrl: origin(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL || urlOnDevHost(metroHost, SUPABASE_PORT),
  ),
  /**
   * development | staging | production, set per build profile in eas.json.
   * Tags error reports so a staging build's crashes never mix with prod's.
   */
  appEnv: parseAppEnv(process.env.EXPO_PUBLIC_APP_ENV),
  /**
   * RevenueCat public SDK key for this platform (docs/billing.md). Unset hides
   * subscription buying; a `test_` key uses RevenueCat's Test Store.
   */
  revenueCatKey:
    (process.env.EXPO_OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) || null,
} as const;
