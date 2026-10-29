import { createBetterAuthClient, type SessionStore } from "@artist/api-client";
import { env } from "./env";

/**
 * `localStorage`, guarded: it can throw (blocked site data, private modes),
 * and a throw here must read as "signed out", not crash the app.
 */
const store: SessionStore = {
  getItem: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Signed in for this tab only; the next load starts signed out.
    }
  },
  removeItem: (key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing stored to remove.
    }
  },
};

/**
 * The web app's sign-in provider, behind the shared `AuthClient` interface:
 * our own Better Auth server in the API. Screens import `auth` from here and
 * never talk to the provider directly, so swapping providers only changes
 * this file.
 */
export const auth = createBetterAuthClient({ apiUrl: env.apiUrl, store });
