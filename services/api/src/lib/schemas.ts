import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "invalid_id");

const attachment = z.object({
  type: z.enum(["image", "video", "audio"]),
  s3Key: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  durationMs: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const inviteAgentSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["owner", "admin", "member"]),
});

export const acceptAgentInviteSchema = z.object({
  inviteId: z.string().min(1),
});

export const sendMessageSchema = z
  .object({
    conversationId: objectId.optional(),
    organizationId: objectId.optional(),
    text: z.string().trim().min(1).max(4096).optional(),
    attachments: z.array(attachment).max(10).optional(),
  })
  .refine((v) => v.conversationId ?? v.organizationId, {
    message: "conversationId_or_organizationId_required",
  })
  .refine((v) => v.text || (v.attachments && v.attachments.length > 0), {
    message: "text_or_attachments_required",
  });

export const updateMessageStatusSchema = z.object({
  status: z.enum(["delivered", "read"]),
});

export const presignAttachmentSchema = z.object({
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  type: z.enum(["image", "video", "audio"]),
  conversationId: objectId,
});

export const requestOtpSchema = z.object({
  channel: z.enum(["sms", "whatsapp"]),
  phone: z.string().trim().min(1),
});

export const verifyOtpSchema = z.object({
  phone: z.string().trim().min(1),
  code: z.string().trim().min(1),
});

export const oauthCallbackSchema = z.object({
  providerToken: z.string().min(1),
});

export const linkIdentifierSchema = z.object({
  type: z.enum(["phone", "email", "govId"]),
  value: z.string().trim().min(1),
});

export const startConversationSchema = z.object({
  organizationId: objectId,
});

export const organizationApprovalActionSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});
