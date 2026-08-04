import { describe, expect, it } from "vitest";
import { isWithinLimit, MAX_ATTACHMENT_BYTES } from "./attachmentLimits.js";

describe("isWithinLimit", () => {
  it("accepts sizes at or below the per-type cap", () => {
    expect(isWithinLimit("image", MAX_ATTACHMENT_BYTES.image)).toBe(true);
    expect(isWithinLimit("video", 1)).toBe(true);
  });

  it("rejects sizes above the per-type cap", () => {
    expect(isWithinLimit("image", MAX_ATTACHMENT_BYTES.image + 1)).toBe(false);
    expect(isWithinLimit("audio", MAX_ATTACHMENT_BYTES.audio + 1)).toBe(false);
  });

  it("rejects zero or negative sizes", () => {
    expect(isWithinLimit("image", 0)).toBe(false);
    expect(isWithinLimit("image", -1)).toBe(false);
  });

  it("does not apply one type's limit to another", () => {
    const overImageLimit = MAX_ATTACHMENT_BYTES.image + 1;
    expect(isWithinLimit("video", overImageLimit)).toBe(true);
  });
});
