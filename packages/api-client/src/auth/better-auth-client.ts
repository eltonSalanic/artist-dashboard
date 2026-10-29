import type {
  AuthClient,
  AuthFailure,
  AuthResult,
  AuthSession,
  SignUpResult,
} from "./auth-client";

/**
 * Where the session is kept between launches: `localStorage` on web, the
 * keychain on the phone. Async so both fit.
 */
export interface SessionStore {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export interface BetterAuthClientOptions {
  /** The API's origin, e.g. http://localhost:3001. Auth lives under /api/auth. */
  apiUrl: string;
  store: SessionStore;
  /** Defaults to the global fetch; injectable for tests. */
  fetch?: typeof fetch;
}

const STORE_KEY = "bandwall.session";

/**
 * The `AuthClient` for our own Better Auth server (the NestJS API). Sessions
 * are opaque tokens that Better Auth hands back in the `set-auth-token`
 * header; we keep the token with who it belongs to and send it as
 * `Authorization: Bearer …`. A session lasts 30 days and slides forward on use,
 * so there is nothing to refresh on a timer.
 *
 * `getSession()` reads the stored session without a network call, the way
 * the previous Supabase client did: being offline must not sign anyone out. A session revoked
 * on the server shows up as a 401 from the API, which `onUnauthorized` turns
 * into a sign-out.
 */
export function createBetterAuthClient(
  options: BetterAuthClientOptions,
): AuthClient {
  const doFetch = options.fetch ?? ((...args) => fetch(...args));
  const authUrl = `${options.apiUrl}/api/auth`;
  const listeners = new Set<(session: AuthSession | null) => void>();
  let current: AuthSession | null | undefined;

  async function load(): Promise<AuthSession | null> {
    if (current !== undefined) return current;
    try {
      const raw = await options.store.getItem(STORE_KEY);
      current = raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      current = null;
    }
    return current;
  }

  async function save(session: AuthSession | null): Promise<void> {
    current = session;
    try {
      if (session) {
        await options.store.setItem(STORE_KEY, JSON.stringify(session));
      } else {
        await options.store.removeItem(STORE_KEY);
      }
    } finally {
      for (const listener of listeners) listener(session);
    }
  }

  /** POSTs to the auth server; a reply carrying a session signs the user in. */
  async function call(
    url: string,
    body: unknown,
    token?: string,
  ): Promise<{ error: AuthFailure | null; data?: unknown }> {
    let response: Response;
    try {
      response = await doFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        // Bearer tokens only. Left to its default, iOS keeps and resends the
        // session cookie Better Auth sets, which the server then refuses.
        credentials: "omit",
      });
    } catch (thrown) {
      return { error: { message: String(thrown), status: 0 } };
    }
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const { code, message } = (data ?? {}) as {
        code?: string;
        message?: string;
      };
      return {
        error: {
          code,
          status: response.status,
          message: message ?? `Request failed (${response.status})`,
        },
      };
    }
    const sessionToken = response.headers.get("set-auth-token");
    const user = (data as { user?: { id: string; email: string } } | null)
      ?.user;
    if (sessionToken && user) {
      await save({
        userId: user.id,
        email: user.email,
        accessToken: sessionToken,
      });
    }
    return { error: null, data };
  }

  const signInWith = async (path: string, body: unknown): Promise<AuthResult> => {
    const { error } = await call(`${authUrl}${path}`, body);
    return { error };
  };

  return {
    getSession: load,

    onSessionChange(callback) {
      listeners.add(callback);
      // Say who is signed in at start-up, before any sign-in or sign-out.
      void load().then((session) => {
        if (listeners.has(callback)) callback(session);
      });
      return () => listeners.delete(callback);
    },

    signIn: (email, password) =>
      signInWith("/sign-in/email", { email, password }),

    async signUp(email, password): Promise<SignUpResult> {
      const { error, data } = await call(`${authUrl}/sign-up/email`, {
        email,
        password,
        // Better Auth requires a name; the app's display name starts the same.
        name: email.split("@")[0],
      });
      const token = (data as { token?: string | null } | null)?.token;
      return { error, needsConfirmation: !error && !token };
    },

    async signOut() {
      const session = await load();
      if (session) {
        // Best effort: the local sign-out below is what the caller relies on,
        // and an unreachable server must not trap anyone in.
        await call(`${authUrl}/sign-out`, {}, session.accessToken);
      }
      await save(null);
    },

    async setPassword(password) {
      const session = await load();
      if (!session) {
        return { error: { message: "Not signed in", status: 401 } };
      }
      const { error } = await call(
        `${options.apiUrl}/me/password`,
        { password },
        session.accessToken,
      );
      return { error };
    },

    verifyInviteCode: (email, code) =>
      signInWith("/sign-in/email-otp", { email, otp: code }),

    startAutoRefresh() {},
    stopAutoRefresh() {},
  };
}
