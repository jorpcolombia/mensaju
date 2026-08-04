import { Router, type Router as ExpressRouter } from "express";
import type { PresignAttachmentRequest, PresignAttachmentResponse } from "@messages/shared-types";
import { resolveRequester } from "../middleware/requester.js";
import { loadAuthorizedConversation } from "../lib/conversationAccess.js";
import { buildAttachmentKey, presignUpload } from "../lib/s3.js";
import { isWithinLimit } from "../lib/attachmentLimits.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateBody } from "../lib/validate.js";
import { presignAttachmentSchema } from "../lib/schemas.js";

export const attachmentsRouter: ExpressRouter = Router();

attachmentsRouter.use(resolveRequester);

attachmentsRouter.post(
  "/presign",
  validateBody(presignAttachmentSchema),
  asyncHandler(async (req, res) => {
    const { mimeType, sizeBytes, type, conversationId } = req.body as PresignAttachmentRequest;

    if (!isWithinLimit(type, sizeBytes)) {
      return res.status(413).json({ error: "attachment_too_large" });
    }

    const { conversation, forbidden } = await loadAuthorizedConversation(req, conversationId);
    if (forbidden) return res.status(403).json({ error: "forbidden" });
    if (!conversation) return res.status(404).json({ error: "not_found" });

    const s3Key = buildAttachmentKey({
      organizationId: String(conversation.organizationId),
      conversationId,
      mimeType,
    });
    const uploadUrl = await presignUpload(s3Key, mimeType);

    const body: PresignAttachmentResponse = {
      uploadUrl,
      s3Key,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
    res.json(body);
  }),
);
