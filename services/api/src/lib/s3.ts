import { randomUUID } from "node:crypto";
import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { required } from "../env.js";

let client: S3Client | undefined;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({ region: required("S3_REGION") });
  }
  return client;
}

export function buildAttachmentKey(params: {
  organizationId: string;
  conversationId: string;
  mimeType: string;
}): string {
  const ext = params.mimeType.split("/")[1] ?? "bin";
  return `orgs/${params.organizationId}/conversations/${params.conversationId}/${randomUUID()}.${ext}`;
}

export async function presignUpload(s3Key: string, mimeType: string) {
  const command = new PutObjectCommand({
    Bucket: required("S3_BUCKET"),
    Key: s3Key,
    ContentType: mimeType,
  });
  const uploadUrl = await getSignedUrl(s3(), command, { expiresIn: 300 });
  return uploadUrl;
}

export async function presignDownload(s3Key: string) {
  const command = new GetObjectCommand({ Bucket: required("S3_BUCKET"), Key: s3Key });
  return getSignedUrl(s3(), command, { expiresIn: 300 });
}

export async function objectExists(s3Key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: required("S3_BUCKET"), Key: s3Key }));
    return true;
  } catch {
    return false;
  }
}
