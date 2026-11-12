import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { AuthResult } from '@artist/api-client';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

/**
 * Sign in with the phone's own Apple or Google sheet, then hand the ID token
 * it returns to our API, which checks it with Apple or Google and opens a
 * session. Nobody is sent to a web page.
 *
 * Resolves `null` when the person closed the sheet: that is not an error, so
 * the screen shows nothing. Rejects when the phone's own sheet fails, which
 * the buttons show as "Couldn't sign in with …", never as a connection error.
 */
export type SocialOutcome = AuthResult | null;

/** Apple's sheet exists on iOS only; Android shows Google alone. */
export const appleAvailable = () =>
  process.env.EXPO_OS === 'ios' ? AppleAuthentication.isAvailableAsync() : Promise.resolve(false);

/** Google needs its client IDs; without them the button stays hidden. */
export const googleAvailable = () =>
  env.googleWebClientId !== null &&
  (process.env.EXPO_OS !== 'ios' || env.googleIosClientId !== null);

export async function signInWithApple(): Promise<SocialOutcome> {
  // Apple signs the hash of this nonce into the token; the API checks the two
  // match, so a token lifted from elsewhere can't be replayed here.
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce,
  );
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (thrown) {
    if ((thrown as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw thrown;
  }
  if (!credential.identityToken) {
    // Thrown, not returned: a status-0 result would read as "Can't reach Band Wall".
    throw new Error('Apple did not return a sign-in token.');
  }
  // Only the first sign-in carries the name, and never inside the token.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ');
  return auth.signInWithIdToken({
    provider: 'apple',
    idToken: credential.identityToken,
    nonce,
    name: name || undefined,
  });
}

let googleConfigured = false;

function configureGoogle() {
  if (googleConfigured) return;
  GoogleSignin.configure({
    // The token's audience: Android asks for one for the Web client, which
    // the API accepts alongside the iOS and Android ones.
    webClientId: env.googleWebClientId ?? undefined,
    iosClientId: env.googleIosClientId ?? undefined,
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<SocialOutcome> {
  configureGoogle();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    const { idToken } = response.data;
    if (!idToken) {
      throw new Error('Google did not return a sign-in token.');
    }
    return auth.signInWithIdToken({ provider: 'google', idToken });
  } catch (thrown) {
    if (isErrorWithCode(thrown) && thrown.code === statusCodes.IN_PROGRESS) return null;
    throw thrown;
  }
}

/**
 * Signing out of the app also forgets the Google account picked, so the next
 * Google sign-in offers the account picker again. Best effort.
 */
export async function forgetGoogleAccount(): Promise<void> {
  if (!googleAvailable()) return;
  try {
    configureGoogle();
    await GoogleSignin.signOut();
  } catch {
    // Nothing to forget, or Google is unreachable: the app is signed out anyway.
  }
}
