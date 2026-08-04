import { beforeEach, describe, expect, it, vi } from "vitest";

const state = new Map<string, number>();

vi.mock("./redis.js", () => ({
  redis: {
    incr: vi.fn(async (key: string) => {
      const next = (state.get(key) ?? 0) + 1;
      state.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1),
  },
}));

const { checkAndIncrementRateLimit } = await import("./rateLimit.js");

describe("checkAndIncrementRateLimit", () => {
  beforeEach(() => {
    state.clear();
  });

  it("allows requests up to the 20/hour cap", async () => {
    for (let i = 0; i < 20; i++) {
      expect(await checkAndIncrementRateLimit("org-1")).toBe(true);
    }
  });

  it("rejects the 21st request within the window", async () => {
    for (let i = 0; i < 20; i++) {
      await checkAndIncrementRateLimit("org-1");
    }
    expect(await checkAndIncrementRateLimit("org-1")).toBe(false);
  });

  it("tracks separate organizations independently", async () => {
    for (let i = 0; i < 20; i++) {
      await checkAndIncrementRateLimit("org-1");
    }
    expect(await checkAndIncrementRateLimit("org-2")).toBe(true);
  });
});
