import {
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
});

configureSessionSource(supabase.auth);
