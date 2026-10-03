import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { clearCacheOnUserChange } from "./clear-cache-on-user-change";

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

function setup() {
  let listener: Listener = () => {};
  const unsubscribe = jest.fn();
  const auth = {
    onAuthStateChange(callback: Listener) {
      listener = callback;
      return { data: { subscription: { unsubscribe } } };
    },
  };
  const cache = { clear: jest.fn() };
  const stop = clearCacheOnUserChange(auth, cache);
  const emit = (event: AuthChangeEvent, userId: string | null) =>
    listener(
      event,
      userId === null ? null : ({ user: { id: userId } } as Session),
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
