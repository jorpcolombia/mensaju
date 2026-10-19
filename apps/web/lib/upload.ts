import type { Attachment, AttachmentType, PresignAttachmentResponse } from "@messages/shared-types";
import { apiFetch } from "./api";

export function attachmentTypeFor(file: File): AttachmentType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

/** Presigns, uploads straight to S3, and returns the attachment metadata to send with a message. */
export async function uploadAttachment(
  file: File,
  conversationId: string,
  token: string | null,
): Promise<Attachment> {
  const type = attachmentTypeFor(file);
  if (!type) throw new Error(`Unsupported file type: ${file.type || "unknown"}`);

  const presign = await apiFetch<PresignAttachmentResponse>("/attachments/presign", token, {
    method: "POST",
    body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size, type, conversationId }),
  });
  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed: ${put.status}`);

  return { type, s3Key: presign.s3Key, mimeType: file.type, sizeBytes: file.size };
}
