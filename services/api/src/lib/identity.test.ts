import { describe, expect, it } from "vitest";
import { normalizeIdentifier } from "./identity.js";

describe("normalizeIdentifier", () => {
  it("lowercases and trims email addresses", () => {
    expect(normalizeIdentifier("email", "  User@Example.COM  ")).toBe("user@example.com");
  });

  it("converts phone numbers to E.164, stripping formatting", () => {
    expect(normalizeIdentifier("phone", "+1 (555) 123-4567")).toBe("+15551234567");
  });

  it("adds a leading + to phone numbers that are missing one", () => {
    expect(normalizeIdentifier("phone", "15551234567")).toBe("+15551234567");
  });

  it("only trims govId values", () => {
    expect(normalizeIdentifier("govId", "  ABC123  ")).toBe("ABC123");
  });
});
