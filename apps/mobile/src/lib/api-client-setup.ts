import { Alert } from 'react-native';
import {
  MESSAGES,
  configureApiClient,
  configureSessionSource,
} from '@artist/api-client';
import { env } from './env';
import { notifier } from './notifier';
import { supabase } from './supabase';

/**
 * Mobile's half of the `@artist/api-client` contract — the mirror of
 * `apps/web/src/lib/api-client-setup.ts`. The package is deliberately ignorant
 * of where the base URL, the token and the toast come from; this is where a
 * phone answers those three questions.
 *
 * Imported for its side effect by the root layout, so it runs before any hook
 * can fire a request.
 */
let signingOut = false;

configureApiClient({
  baseUrl: env.apiUrl,
  getAccessToken: async () => {
    // `getSession()` refreshes an expired token before returning, so this is
    // also what keeps a long-running app's requests authenticated.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  },
  notify: notifier,
  // The API rejected a token we still held: the session is gone server-side.
  // Signing out swaps the stack to sign-in (the root layout's guard); one
  // alert says why, instead of a screen of failed requests.
  onUnauthorized: () => {
    if (signingOut) return;
    signingOut = true;
    void supabase.auth.signOut().finally(() => {
      signingOut = false;
      Alert.alert(MESSAGES.sessionExpired);
    });
  },
});

configureSessionSource(supabase.auth);
