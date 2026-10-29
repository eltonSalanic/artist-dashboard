import { createBetterAuthClient, type SessionStore } from "./better-auth-client";

function memoryStore(initial?: string): SessionStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial) data.set("bandwall.session", initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function reply(status: number, body: unknown, token?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: token ? { "set-auth-token": token } : {},
  });
}

const user = { id: "u1", email: "a@band.com" };

describe("createBetterAuthClient", () => {
  it("signs in, keeps the session token, and announces it", async () => {
    const store = memoryStore();
    const fetch = jest.fn().mockResolvedValue(reply(200, { token: "t", user }, "t.sig"));
    const auth = createBetterAuthClient({ apiUrl: "http://api", store, fetch });
    const seen: unknown[] = [];
    auth.onSessionChange((s) => seen.push(s));

    await expect(auth.signIn("a@band.com", "pw")).resolves.toEqual({ error: null });

    expect(fetch).toHaveBeenCalledWith(
      "http://api/api/auth/sign-in/email",
      expect.objectContaining({ method: "POST" }),
    );
    const session = { userId: "u1", email: "a@band.com", accessToken: "t.sig" };
    await expect(auth.getSession()).resolves.toEqual(session);
    expect(JSON.parse(store.data.get("bandwall.session")!)).toEqual(session);
    expect(seen).toContainEqual(session);
  });

  it("returns the server's code on a refused sign-in", async () => {
    const fetch = jest.fn().mockResolvedValue(
      reply(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }),
    );
    const auth = createBetterAuthClient({ apiUrl: "http://api", store: memoryStore(), fetch });
    const { error } = await auth.signIn("a@band.com", "bad");
    expect(error).toMatchObject({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 });
    await expect(auth.getSession()).resolves.toBeNull();
  });

  it("reports an unreachable server as status 0 instead of throwing", async () => {
    const fetch = jest.fn().mockRejectedValue(new TypeError("Network request failed"));
    const auth = createBetterAuthClient({ apiUrl: "http://api", store: memoryStore(), fetch });
    const { error } = await auth.signIn("a@band.com", "pw");
    expect(error?.status).toBe(0);
  });

  it("reads the stored session without a network call", async () => {
    const stored = { userId: "u1", email: "a@band.com", accessToken: "t" };
    const fetch = jest.fn();
    const auth = createBetterAuthClient({
      apiUrl: "http://api",
      store: memoryStore(JSON.stringify(stored)),
      fetch,
    });
    await expect(auth.getSession()).resolves.toEqual(stored);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signs out locally even when the server can't be reached", async () => {
    const store = memoryStore(JSON.stringify({ userId: "u1", email: "a", accessToken: "t" }));
    const fetch = jest.fn().mockRejectedValue(new TypeError("offline"));
    const auth = createBetterAuthClient({ apiUrl: "http://api", store, fetch });
    await auth.signOut();
    await expect(auth.getSession()).resolves.toBeNull();
    expect(store.data.size).toBe(0);
  });

  it("signs in with an invite code", async () => {
    const fetch = jest.fn().mockResolvedValue(reply(200, { token: "t", user }, "t.sig"));
    const auth = createBetterAuthClient({ apiUrl: "http://api", store: memoryStore(), fetch });
    await auth.verifyInviteCode("a@band.com", "123456");
    expect(fetch).toHaveBeenCalledWith(
      "http://api/api/auth/sign-in/email-otp",
      expect.objectContaining({ body: JSON.stringify({ email: "a@band.com", otp: "123456" }) }),
    );
    await expect(auth.getSession()).resolves.toMatchObject({ userId: "u1" });
  });

  it("sets a password through the API with the session token", async () => {
    const fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const auth = createBetterAuthClient({
      apiUrl: "http://api",
      store: memoryStore(JSON.stringify({ userId: "u1", email: "a", accessToken: "t" })),
      fetch,
    });
    await expect(auth.setPassword("long-enough")).resolves.toEqual({ error: null });
    expect(fetch).toHaveBeenCalledWith(
      "http://api/me/password",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer t" }),
      }),
    );
  });

  it("flags a sign-up that still needs email confirmation", async () => {
    const fetch = jest.fn().mockResolvedValue(reply(200, { token: null, user }));
    const auth = createBetterAuthClient({ apiUrl: "http://api", store: memoryStore(), fetch });
    await expect(auth.signUp("a@band.com", "pw-long-enough")).resolves.toEqual({
      error: null,
      needsConfirmation: true,
    });
  });
});
