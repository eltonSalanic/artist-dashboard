import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAuthClient } from "./supabase-auth-client";

type SupabaseAuth = SupabaseClient["auth"];

const session = {
  access_token: "token",
  user: { id: "user-1", email: "a@example.com" },
};

function setup(overrides: Partial<Record<keyof SupabaseAuth, unknown>>) {
  return createSupabaseAuthClient(overrides as unknown as SupabaseAuth);
}

describe("createSupabaseAuthClient", () => {
  it("maps the stored session to the app's own shape", async () => {
    const auth = setup({
      getSession: jest.fn().mockResolvedValue({ data: { session } }),
    });
    await expect(auth.getSession()).resolves.toEqual({
      userId: "user-1",
      email: "a@example.com",
      accessToken: "token",
    });
  });

  it("passes session changes through and unsubscribes", () => {
    const unsubscribe = jest.fn();
    let listener: (event: string, s: unknown) => void = () => {};
    const auth = setup({
      onAuthStateChange: jest.fn((cb) => {
        listener = cb;
        return { data: { subscription: { unsubscribe } } };
      }),
    });
    const seen: unknown[] = [];
    const stop = auth.onSessionChange((s) => seen.push(s));
    listener("SIGNED_IN", session);
    listener("SIGNED_OUT", null);
    stop();
    expect(seen).toEqual([
      { userId: "user-1", email: "a@example.com", accessToken: "token" },
      null,
    ]);
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("returns a provider error in the shape authErrorMessage reads", async () => {
    const auth = setup({
      signInWithPassword: jest.fn().mockResolvedValue({
        data: {},
        error: { name: "AuthApiError", code: "invalid_credentials", status: 400, message: "Invalid login" },
      }),
    });
    await expect(auth.signIn("a@example.com", "pw")).resolves.toEqual({
      error: { name: "AuthApiError", code: "invalid_credentials", status: 400, message: "Invalid login" },
    });
  });

  it("reports a thrown network failure as status 0 instead of throwing", async () => {
    const auth = setup({
      signInWithPassword: jest.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    });
    const { error } = await auth.signIn("a@example.com", "pw");
    expect(error?.status).toBe(0);
  });

  it("flags a sign-up that needs email confirmation", async () => {
    const auth = setup({
      signUp: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    });
    await expect(auth.signUp("a@example.com", "pw")).resolves.toEqual({
      error: null,
      needsConfirmation: true,
    });
  });

  it("verifies an invite code as an invite OTP", async () => {
    const verifyOtp = jest.fn().mockResolvedValue({ data: {}, error: null });
    const auth = setup({ verifyOtp });
    await auth.verifyInviteCode("a@example.com", "123456");
    expect(verifyOtp).toHaveBeenCalledWith({
      email: "a@example.com",
      token: "123456",
      type: "invite",
    });
  });

  it("never throws on sign-out", async () => {
    const auth = setup({ signOut: jest.fn().mockRejectedValue(new Error("offline")) });
    await expect(auth.signOut()).resolves.toBeUndefined();
  });
});
