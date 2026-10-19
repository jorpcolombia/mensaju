import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, findAttachmentProblem, isWithinLimit } from "./attachmentLimits.js";

describe("isWithinLimit", () => {
  it("accepts sizes up to the per-type limit", () => {
    expect(isWithinLimit("image", MAX_ATTACHMENT_BYTES.image)).toBe(true);
    expect(isWithinLimit("video", MAX_ATTACHMENT_BYTES.video)).toBe(true);
    expect(isWithinLimit("audio", MAX_ATTACHMENT_BYTES.audio)).toBe(true);
  });

  it("rejects sizes over the limit or non-positive", () => {
    expect(isWithinLimit("image", MAX_ATTACHMENT_BYTES.image + 1)).toBe(false);
    expect(isWithinLimit("audio", 0)).toBe(false);
  });
});

describe("findAttachmentProblem", () => {
  const org = "a".repeat(24);
  const conv = "b".repeat(24);
  const ok = {
    type: "image" as const,
    s3Key: `orgs/${org}/conversations/${conv}/x.png`,
    mimeType: "image/png",
    sizeBytes: 1000,
  };

  it("accepts a consistent attachment", () => {
    expect(findAttachmentProblem(ok, org, conv)).toBeNull();
  });

  it("rejects keys outside the conversation prefix", () => {
    expect(findAttachmentProblem({ ...ok, s3Key: "orgs/other/x.png" }, org, conv)).toBe(
      "attachment_key_mismatch",
    );
    expect(
      findAttachmentProblem({ ...ok, s3Key: `orgs/${org}/conversations/${conv}/../x.png` }, org, conv),
    ).toBe("attachment_key_mismatch");
  });

  it("rejects a MIME type that doesn't match the declared type", () => {
    expect(findAttachmentProblem({ ...ok, mimeType: "video/mp4" }, org, conv)).toBe(
      "attachment_type_mismatch",
    );
  });

  it("rejects oversize attachments", () => {
    expect(findAttachmentProblem({ ...ok, sizeBytes: MAX_ATTACHMENT_BYTES.image + 1 }, org, conv)).toBe(
      "attachment_too_large",
    );
  });
});
