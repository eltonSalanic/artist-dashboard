import type { AuthErrorLike } from "../messages";

/**
 * Who is signed in, in the app's own terms. Screens and hooks only ever see
 * this, never a provider's session object, so swapping the auth provider
 * means writing one new `AuthClient`, not touching every screen.
 */
export interface AuthSession {
  userId: string;
  email: string | null;
  /** Bearer token the API checks. */
  accessToken: string;
}

/**
 * A failed auth call, in the shape `authErrorMessage()` words for people.
 * `status: 0` means the provider could not be reached.
 */
export type AuthFailure = AuthErrorLike;

export type AuthResult = { error: AuthFailure | null };

/** What the native Apple or Google sign-in sheet hands back. */
export interface SocialCredential {
  provider: "apple" | "google";
  idToken: string;
  /** The raw nonce whose hash went into the request (Apple). */
  nonce?: string;
  /**
   * Apple sends the person's name only the first time they sign in, and
   * never in the token, so it is passed along here.
   */
  name?: string;
}

export type SignUpResult = AuthResult & {
  /**
   * True when the account exists but has no session yet, because the
   * provider wants the email confirmed first.
   */
  needsConfirmation: boolean;
};

/**
 * Everything the apps ask of an auth provider. Methods resolve with
 * `{ error }` instead of throwing, network failures included, so a screen
 * handles every outcome in one place.
 */
export interface AuthClient {
  /** The stored session, refreshed first if its token has expired. */
  getSession(): Promise<AuthSession | null>;
  /**
   * Fires on sign-in, sign-out and token refresh, and once at startup with
   * the stored session. Returns an unsubscribe function.
   */
  onSessionChange(callback: (session: AuthSession | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthResult>;
  /** `name` is what bandmates see; without one it starts as the email's first part. */
  signUp(email: string, password: string, name?: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
  /** Sets the signed-in user's password (after an invite, or a change). */
  setPassword(password: string): Promise<AuthResult>;
  /** Signs in with the 6-digit code from an invite email. */
  verifyInviteCode(email: string, code: string): Promise<AuthResult>;
  /**
   * Signs in with an ID token from the phone's native Apple or Google sheet.
   * The first time creates the account; an existing account with the same
   * email is signed into instead of a second one being made.
   */
  signInWithIdToken(credential: SocialCredential): Promise<AuthResult>;
  /**
   * Background token refresh. Phones pause it while the app is in the
   * background, because the OS suspends timers there; browsers never call it.
   */
  startAutoRefresh(): void;
  stopAutoRefresh(): void;
}

let client: AuthClient | null = null;

/**
 * Module-level like `configureApiClient`: each app builds its client once at
 * startup, and `useSession()` reads it from here.
 */
export function configureAuthClient(next: AuthClient): void {
  client = next;
}

export function getAuthClient(): AuthClient {
  if (!client) {
    throw new Error("configureAuthClient() must be called before auth is used");
  }
  return client;
}
