import { createSupabaseAuthClient } from '@artist/api-client';
import { supabase } from './supabase';

/**
 * The phone's sign-in provider, behind the shared `AuthClient` interface.
 * Screens import `auth` from here and never touch `supabase.auth` directly, so
 * swapping providers only changes this file (and the keychain-backed client
 * it wraps).
 */
export const auth = createSupabaseAuthClient(supabase.auth);
