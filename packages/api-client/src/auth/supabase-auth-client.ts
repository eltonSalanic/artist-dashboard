import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type {
  AuthClient,
  AuthFailure,
  AuthResult,
  AuthSession,
  SignUpResult,
} from "./auth-client";

/**
 * The one place that knows how Supabase Auth works. Takes the app's own
 * `supabase.auth` (web's is backed by `localStorage`, mobile's by
 * `expo-secure-store`), so this package still depends on Supabase for types
 * only.
 */
export function createSupabaseAuthClient(
  auth: SupabaseClient["auth"],
): AuthClient {
  return {
    async getSession() {
      try {
        const { data } = await auth.getSession();
        return toAuthSession(data.session);
      } catch {
        return null;
      }
    },

    onSessionChange(callback) {
      const {
        data: { subscription },
      } = auth.onAuthStateChange((_event, session) =>
        callback(toAuthSession(session)),
      );
      return () => subscription.unsubscribe();
    },

    signIn: (email, password) =>
      settle(() => auth.signInWithPassword({ email, password })),

    async signUp(email, password): Promise<SignUpResult> {
      let needsConfirmation = false;
      const { error } = await settle(async () => {
        const result = await auth.signUp({ email, password });
        // No session means the project requires email confirmation.
        needsConfirmation = !result.error && result.data.session === null;
        return result;
      });
      return { error, needsConfirmation: error ? false : needsConfirmation };
    },

    async signOut() {
      try {
        await auth.signOut();
      } catch {
        // Signing out also clears the stored session locally, which is all a
        // caller relies on; an unreachable server must not trap them in.
      }
    },

    setPassword: (password) => settle(() => auth.updateUser({ password })),

    verifyInviteCode: (email, code) =>
      settle(() => auth.verifyOtp({ email, token: code, type: "invite" })),

    startAutoRefresh: () => void auth.startAutoRefresh(),
    stopAutoRefresh: () => void auth.stopAutoRefresh(),
  };
}

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    accessToken: session.access_token,
  };
}

/**
 * supabase-js usually returns `{ error }`, but can also throw (a network
 * failure mid-request). Either way the caller gets `{ error }`, with a throw
 * reported as `status: 0` so `authErrorMessage()` says "can't reach".
 */
async function settle(
  call: () => Promise<{ error: AuthFailure | null }>,
): Promise<AuthResult> {
  try {
    const { error } = await call();
    return { error: error ? toFailure(error) : null };
  } catch (thrown) {
    return { error: { message: String(thrown), status: 0 } };
  }
}

function toFailure(error: AuthFailure): AuthFailure {
  return {
    name: error.name,
    code: error.code,
    status: error.status,
    message: error.message,
  };
}
