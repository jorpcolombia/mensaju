import { describe, expect, it } from "vitest";
import { presignAttachmentSchema, sendMessageSchema, updateMessageStatusSchema } from "./schemas.js";

const OBJECT_ID = "507f1f77bcf86cd799439011";

describe("sendMessageSchema", () => {
  it("accepts a message with text and a conversationId", () => {
    const result = sendMessageSchema.safeParse({ conversationId: OBJECT_ID, text: "hi" });
    expect(result.success).toBe(true);
  });

  it("rejects when neither conversationId nor organizationId is present", () => {
    const result = sendMessageSchema.safeParse({ text: "hi" });
    expect(result.success).toBe(false);
  });

  it("rejects when neither text nor attachments is present", () => {
    const result = sendMessageSchema.safeParse({ conversationId: OBJECT_ID });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed conversationId", () => {
    const result = sendMessageSchema.safeParse({ conversationId: "not-an-object-id", text: "hi" });
    expect(result.success).toBe(false);
  });
});

describe("updateMessageStatusSchema", () => {
  it("accepts delivered and read", () => {
    expect(updateMessageStatusSchema.safeParse({ status: "delivered" }).success).toBe(true);
    expect(updateMessageStatusSchema.safeParse({ status: "read" }).success).toBe(true);
  });

  it("rejects any other status, including sent", () => {
    expect(updateMessageStatusSchema.safeParse({ status: "sent" }).success).toBe(false);
    expect(updateMessageStatusSchema.safeParse({ status: "bogus" }).success).toBe(false);
  });
});

describe("presignAttachmentSchema", () => {
  it("accepts a well-formed presign request", () => {
    const result = presignAttachmentSchema.safeParse({
      mimeType: "image/png",
      sizeBytes: 1024,
      type: "image",
      conversationId: OBJECT_ID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive sizeBytes", () => {
    const result = presignAttachmentSchema.safeParse({
      mimeType: "image/png",
      sizeBytes: 0,
      type: "image",
      conversationId: OBJECT_ID,
    });
    expect(result.success).toBe(false);
  });
});
