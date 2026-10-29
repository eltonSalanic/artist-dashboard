import * as SecureStore from 'expo-secure-store';
import { createBetterAuthClient } from '@artist/api-client';
import { createChunkedStore } from './chunked-store';
import { env } from './env';

/**
 * `AFTER_FIRST_UNLOCK` rather than the default `WHEN_UNLOCKED`: a request
 * made while the phone is locked (a background refetch) reads the session, and
 * a `WHEN_UNLOCKED` read fails there, which would look like "signed out".
 * After the first unlock following a reboot, the keychain stays readable.
 */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * The keychain, not AsyncStorage: it is encrypted and excluded from device
 * backups, which is where a session token belongs.
 */
const store = createChunkedStore({
  getItemAsync: (key) => SecureStore.getItemAsync(key, options),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, options),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key, options),
});

/**
 * The phone's sign-in provider, behind the shared `AuthClient` interface: our
 * own Better Auth server in the API. Screens import `auth` from here and never
 * talk to the provider directly, so swapping providers only changes this file.
 */
export const auth = createBetterAuthClient({ apiUrl: env.apiUrl, store });
