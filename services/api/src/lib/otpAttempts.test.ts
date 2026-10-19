import { beforeEach, describe, expect, it, vi } from "vitest";

const state = new Map<string, number>();

vi.mock("./redis.js", () => ({
  redis: {
    eval: vi.fn(async (_s: string, _n: number, key: string) => {
      const next = (state.get(key) ?? 0) + 1;
      state.set(key, next);
      return next;
    }),
    get: vi.fn(async (key: string) => (state.has(key) ? String(state.get(key)) : null)),
    del: vi.fn(async (key: string) => state.delete(key)),
  },
}));

const { isOtpLockedOut, recordFailedOtpAttempt, clearOtpAttempts } = await import("./otpAttempts.js");

describe("otp attempt lockout", () => {
  beforeEach(() => state.clear());

  it("locks out after five failures", async () => {
    for (let i = 0; i < 4; i++) await recordFailedOtpAttempt("+15550001");
    expect(await isOtpLockedOut("+15550001")).toBe(false);
    await recordFailedOtpAttempt("+15550001");
    expect(await isOtpLockedOut("+15550001")).toBe(true);
  });

  it("is per phone number and can be cleared", async () => {
    for (let i = 0; i < 5; i++) await recordFailedOtpAttempt("+15550001");
    expect(await isOtpLockedOut("+15550002")).toBe(false);
    await clearOtpAttempts("+15550001");
    expect(await isOtpLockedOut("+15550001")).toBe(false);
  });
});
