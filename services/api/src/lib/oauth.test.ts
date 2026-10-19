import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../env.js", () => ({
  env: { googleClientIds: ["our-client"], appleClientIds: [] },
}));

const { verifyOAuthToken } = await import("./oauth.js");

function mockTokenInfo(payload: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => payload })),
  );
}

describe("verifyOAuthToken (google)", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("rejects a token minted for a different app", async () => {
    mockTokenInfo({ sub: "1", aud: "someone-else", email: "a@b.c", email_verified: "true" });
    await expect(verifyOAuthToken("google", "t")).rejects.toThrow(/audience/);
  });

  it("returns the email only when the provider verified it", async () => {
    mockTokenInfo({ sub: "1", aud: "our-client", email: "a@b.c", email_verified: "true" });
    expect(await verifyOAuthToken("google", "t")).toEqual({ providerUserId: "1", email: "a@b.c" });

    mockTokenInfo({ sub: "1", aud: "our-client", email: "a@b.c", email_verified: "false" });
    expect((await verifyOAuthToken("google", "t")).email).toBeUndefined();
  });
});

describe("verifyOAuthToken (apple)", () => {
  it("rejects an unsigned/malformed identity token instead of trusting its payload", async () => {
    const forged = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"x"}').toString("base64url")}.`;
    await expect(verifyOAuthToken("apple", forged)).rejects.toThrow();
  });
});
