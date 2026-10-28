import type { AuthSession } from "@artist/api-client";
import { clearCacheOnUserChange } from "./clear-cache-on-user-change";

type Listener = (session: AuthSession | null) => void;
/** Kept only to label each step; the auth client doesn't pass it on. */
type Event = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED";

function setup() {
  let listener: Listener = () => {};
  const unsubscribe = jest.fn();
  const auth = {
    onSessionChange(callback: Listener) {
      listener = callback;
      return unsubscribe;
    },
  };
  const cache = { clear: jest.fn() };
  const stop = clearCacheOnUserChange(auth, cache);
  const emit = (_event: Event, userId: string | null) =>
    listener(
      userId === null
        ? null
        : { userId, email: null, accessToken: "token" },
    );
  return { cache, emit, stop, unsubscribe };
}

describe("clearCacheOnUserChange", () => {
  it("leaves the cache alone for the session found at page load", () => {
    const { cache, emit } = setup();
    emit("INITIAL_SESSION", "a");
    expect(cache.clear).not.toHaveBeenCalled();
  });

  it("clears on sign-out", () => {
    const { cache, emit } = setup();
    emit("INITIAL_SESSION", "a");
    emit("SIGNED_OUT", null);
    expect(cache.clear).toHaveBeenCalledTimes(1);
  });

  it("clears when someone else signs in without a sign-out first", () => {
    const { cache, emit } = setup();
    emit("INITIAL_SESSION", "a");
    emit("SIGNED_IN", "b");
    expect(cache.clear).toHaveBeenCalledTimes(1);
  });

  it("clears again when the next person signs in after a sign-out", () => {
    // The sign-out clear can run before in-flight requests for the old user
    // land back in the cache, so the sign-in clears too.
    const { cache, emit } = setup();
    emit("INITIAL_SESSION", "a");
    emit("SIGNED_OUT", null);
    emit("SIGNED_IN", "b");
    expect(cache.clear).toHaveBeenCalledTimes(2);
  });

  it("keeps the cache through token refreshes and re-sign-in as the same user", () => {
    const { cache, emit } = setup();
    emit("INITIAL_SESSION", "a");
    emit("TOKEN_REFRESHED", "a");
    emit("SIGNED_IN", "a");
    expect(cache.clear).not.toHaveBeenCalled();
  });

  it("unsubscribes when stopped", () => {
    const { stop, unsubscribe } = setup();
    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
