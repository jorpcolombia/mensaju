import type { AttachmentType } from "@messages/shared-types";

/** Confirmed defaults, plan §6/§11. */
export const MAX_ATTACHMENT_BYTES: Record<AttachmentType, number> = {
  image: 15 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
};

export function isWithinLimit(type: AttachmentType, sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_ATTACHMENT_BYTES[type];
}
