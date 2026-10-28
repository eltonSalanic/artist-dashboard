import { toast } from "sonner";
import { configureApiClient, configureAuthClient } from "@artist/api-client";
import { env } from "./env";
import { auth } from "./auth";

/**
 * Web's half of the `@artist/api-client` contract. The package deliberately
 * knows nothing about Next.js env vars, the browser auth client, or sonner —
 * mobile supplies an `expo-secure-store` backed one, an `expo-constants` URL and
 * its own toast instead.
 *
 * Imported for its side effect by the app shell, so it runs before any hook
 * fires a request.
 */
let signingOut = false;

configureApiClient({
  baseUrl: env.apiUrl,
  getAccessToken: async () => (await auth.getSession())?.accessToken ?? null,
  notify: {
    error: (message) => toast.error(message),
    success: (message) => toast.success(message),
  },
  // The API rejected a token we still had: the session is gone (expired,
  // revoked, or the user was removed). Sign out once and say why, instead of
  // leaving them on a page of "Your session expired" toasts.
  onUnauthorized: () => {
    if (signingOut) return;
    signingOut = true;
    void auth.signOut().finally(() => {
      window.location.assign("/login?expired=1");
    });
  },
});

configureAuthClient(auth);
