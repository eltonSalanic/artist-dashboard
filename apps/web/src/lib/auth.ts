import { createSupabaseAuthClient } from "@artist/api-client";
import { supabase } from "./supabase";

/**
 * The web app's sign-in provider, behind the shared `AuthClient` interface.
 * Screens import `auth` from here and never touch `supabase.auth` directly, so
 * swapping providers only changes this file.
 */
export const auth = createSupabaseAuthClient(supabase.auth);
