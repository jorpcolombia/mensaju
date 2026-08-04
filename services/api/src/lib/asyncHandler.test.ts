import { describe, expect, it, vi } from "vitest";
import { asyncHandler } from "./asyncHandler.js";

describe("asyncHandler", () => {
  it("forwards a rejected promise to next() instead of throwing", async () => {
    const error = new Error("boom");
    const handler = asyncHandler(async () => {
      throw error;
    });
    const next = vi.fn();

    handler({} as any, {} as any, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(error);
  });

  it("does not call next() when the handler resolves normally", async () => {
    const handler = asyncHandler(async () => "ok");
    const next = vi.fn();

    handler({} as any, {} as any, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).not.toHaveBeenCalled();
  });
});
