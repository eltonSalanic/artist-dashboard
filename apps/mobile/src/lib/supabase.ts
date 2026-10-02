import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createChunkedStore } from './chunked-store';
import { env } from './env';

/**
 * `AFTER_FIRST_UNLOCK` rather than the default `WHEN_UNLOCKED`: the access
 * token is refreshed on a timer, and on a locked phone a `WHEN_UNLOCKED` read
 * fails — which Supabase sees as "no stored session". After the first unlock
 * following a reboot, the keychain stays readable, so refreshes survive a
 * pocketed phone.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const storage = createChunkedStore({
  getItemAsync: (key) => SecureStore.getItemAsync(key, options),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
});

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    // supabase-js defaults to `localStorage`, which does not exist here. The
    // keychain is also the right place for a refresh token: unlike
    // AsyncStorage it is encrypted and excluded from device backups.
    storage,
    persistSession: true,
    autoRefreshToken: true,
    // There is no URL bar on a phone. Left on, gotrue-js looks for tokens in
    // `window.location` on startup and throws. Email links (invites) are still
    // handled by the web app — see docs/mobile-app.md.
    detectSessionInUrl: false,
  },
});
