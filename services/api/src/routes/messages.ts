import { Router, type Router as ExpressRouter } from "express";
import { Conversation, Message, Organization } from "@messages/db";
import type {
  ListMessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
  UpdateMessageStatusRequest,
} from "@messages/shared-types";
import { resolveRequester } from "../middleware/requester.js";
import { loadAuthorizedConversation } from "../lib/conversationAccess.js";
import { checkAndIncrementRateLimit } from "../lib/rateLimit.js";
import { conversationChannelName, orgNotificationsChannelName, publish } from "../lib/ably.js";
import { objectExists } from "../lib/s3.js";
import { toMessageDto } from "../lib/dto.js";

export const messagesRouter: ExpressRouter = Router();

messagesRouter.use(resolveRequester);

messagesRouter.get("/conversations/:id/messages", async (req, res) => {
  const { conversation, forbidden } = await loadAuthorizedConversation(req, req.params.id);
  if (forbidden) return res.status(403).json({ error: "forbidden" });
  if (!conversation) return res.status(404).json({ error: "not_found" });

  const messages = await Message.find({ conversationId: conversation._id }).sort({
    createdAt: 1,
  });
  const body: ListMessagesResponse = { messages: messages.map(toMessageDto) };
  res.json(body);
});

messagesRouter.post("/messages", async (req, res) => {
  const { conversationId, organizationId, text, attachments } = req.body as SendMessageRequest;

  let conversation;
  if (conversationId) {
    const result = await loadAuthorizedConversation(req, conversationId);
    if (result.forbidden) return res.status(403).json({ error: "forbidden" });
    conversation = result.conversation;
    if (!conversation) return res.status(404).json({ error: "not_found" });
  } else if (organizationId && req.customerId) {
    conversation = await Conversation.findOneAndUpdate(
      { organizationId, customerId: req.customerId },
      { $setOnInsert: { organizationId, customerId: req.customerId } },
      { upsert: true, new: true },
    );
  } else {
    return res.status(400).json({ error: "conversationId_or_organizationId_required" });
  }

  if (req.agent) {
    const organization = await Organization.findById(conversation.organizationId);
    if (!organization) return res.status(404).json({ error: "organization_not_found" });
    if (organization.approvalStatus === "suspended" || organization.approvalStatus === "rejected") {
      return res.status(403).json({ error: "organization_blocked" });
    }
    if (organization.approvalStatus === "pending") {
      const allowed = await checkAndIncrementRateLimit(String(organization._id));
      if (!allowed) {
        return res.status(429).json({ error: "rate_limit_exceeded" });
      }
    }
  }

  if (attachments?.length) {
    const checks = await Promise.all(attachments.map((a) => objectExists(a.s3Key)));
    if (checks.some((exists) => !exists)) {
      return res.status(400).json({ error: "attachment_not_uploaded" });
    }
  }

  const senderType = req.agent ? "agent" : "customer";
  const senderId = req.agent ? req.agent._id : req.customerId;

  const message = await Message.create({
    conversationId: conversation._id,
    organizationId: conversation.organizationId,
    senderType,
    senderId,
    text,
    attachments: attachments ?? [],
    status: "sent",
  });

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessagePreview = text?.slice(0, 140);
  await conversation.save();

  const dto = toMessageDto(message);
  await publish(conversationChannelName(String(conversation._id)), "message.new", dto);
  await publish(orgNotificationsChannelName(String(conversation.organizationId)), "conversation.updated", {
    conversationId: String(conversation._id),
  });

  const body: SendMessageResponse = { message: dto };
  res.status(201).json(body);
});

messagesRouter.post("/messages/:id/status", async (req, res) => {
  const { status } = req.body as UpdateMessageStatusRequest;
  const message = await Message.findById(req.params.id);
  if (!message) return res.status(404).json({ error: "not_found" });

  const { forbidden } = await loadAuthorizedConversation(req, String(message.conversationId));
  if (forbidden) return res.status(403).json({ error: "forbidden" });

  message.status = status;
  if (status === "delivered") message.deliveredAt = new Date();
  if (status === "read") message.readAt = new Date();
  await message.save();

  const dto = toMessageDto(message);
  await publish(conversationChannelName(String(message.conversationId)), "message.status", dto);

  res.json({ message: dto });
});
