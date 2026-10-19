import type { Attachment, AttachmentType } from "@messages/shared-types";

/** Confirmed defaults, plan §6/§11. */
export const MAX_ATTACHMENT_BYTES: Record<AttachmentType, number> = {
  image: 15 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
};

export function isWithinLimit(type: AttachmentType, sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_ATTACHMENT_BYTES[type];
}

export function attachmentKeyPrefix(organizationId: string, conversationId: string): string {
  return `orgs/${organizationId}/conversations/${conversationId}/`;
}

export type AttachmentProblem =
  | "attachment_key_mismatch"
  | "attachment_type_mismatch"
  | "attachment_too_large";

/**
 * Checks the client-declared attachment metadata for internal consistency:
 * the S3 key must live under this conversation's prefix (so a client can't
 * attach another tenant's object), the MIME type must match the declared
 * media type, and the declared size must be within the per-type limit.
 */
export function findAttachmentProblem(
  attachment: Pick<Attachment, "type" | "s3Key" | "mimeType" | "sizeBytes">,
  organizationId: string,
  conversationId: string,
): AttachmentProblem | null {
  const prefix = attachmentKeyPrefix(organizationId, conversationId);
  if (!attachment.s3Key.startsWith(prefix) || attachment.s3Key.includes("..")) {
    return "attachment_key_mismatch";
  }
  if (!attachment.mimeType.startsWith(`${attachment.type}/`)) {
    return "attachment_type_mismatch";
  }
  if (!isWithinLimit(attachment.type, attachment.sizeBytes)) {
    return "attachment_too_large";
  }
  return null;
}
