import { Router, type Router as ExpressRouter } from "express";
import type { HydratedDocument } from "mongoose";
import { Conversation, Message, Organization } from "@messages/db";
import type { ConversationDoc } from "@messages/db";
import type {
  ListMessagesResponse,
  MarkConversationReadResponse,
  SendMessageRequest,
  SendMessageResponse,
} from "@messages/shared-types";
import { resolveRequester } from "../middleware/requester.js";
import { loadAuthorizedConversation } from "../lib/conversationAccess.js";
import { checkAndIncrementRateLimit, refundRateLimit } from "../lib/rateLimit.js";
import { conversationChannelName, publish } from "../lib/ably.js";
import { getObjectSize, presignDownload } from "../lib/s3.js";
import { findAttachmentProblem } from "../lib/attachmentLimits.js";
import { toMessageDto } from "../lib/dto.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateBody } from "../lib/validate.js";
import {
  listMessagesQuerySchema,
  sendMessageSchema,
  updateMessageStatusSchema,
} from "../lib/schemas.js";
import { resolveOrCreateCustomer } from "../lib/identity.js";
import { notifyUnregisteredCustomer } from "../lib/customerNotify.js";
import { fanOutNewMessage } from "../lib/messageDelivery.js";

export const messagesRouter: ExpressRouter = Router();

// This router is mounted at "/", so auth must be attached per route: a router-wide
// resolveRequester would run for every later router too (e.g. /admin, which uses a
// different Clerk app) and reject their tokens.

const STATUS_RANK = { sent: 0, delivered: 1, read: 2 } as const;

messagesRouter.get(
  "/conversations/:id/messages",
  resolveRequester,
  asyncHandler(async (req, res) => {
    const { conversation, forbidden } = await loadAuthorizedConversation(req, req.params.id);
    if (forbidden) return res.status(403).json({ error: "forbidden" });
    if (!conversation) return res.status(404).json({ error: "not_found" });

    const { limit, before } = listMessagesQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = { conversationId: conversation._id };
    if (before) filter._id = { $lt: before };

    // Newest page first from the DB, returned oldest-first for display.
    const page = await Message.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1);
    const hasMore = page.length > limit;
    const messages = page.slice(0, limit).reverse();

    const dtos = await Promise.all(
      messages.map(async (m) => {
        const dto = toMessageDto(m);
        dto.attachments = await Promise.all(
          dto.attachments.map(async (a) => ({ ...a, url: await presignDownload(a.s3Key) })),
        );
        return dto;
      }),
    );

    const body: ListMessagesResponse = {
      messages: dtos,
      nextCursor: hasMore && messages[0] ? String(messages[0]._id) : undefined,
    };
    res.json(body);
  }),
);

messagesRouter.post(
  "/messages",
  resolveRequester,
  validateBody(sendMessageSchema),
  asyncHandler(async (req, res) => {
    const { conversationId, organizationId, customer, text, attachments } =
      req.body as SendMessageRequest;

    let conversation: HydratedDocument<ConversationDoc> | null = null;
    let conversationCreated = false;
    let outreach: NonNullable<SendMessageRequest["customer"]> | null = null;

    if (conversationId) {
      const result = await loadAuthorizedConversation(req, conversationId);
      if (result.forbidden) return res.status(403).json({ error: "forbidden" });
      conversation = result.conversation;
      if (!conversation) return res.status(404).json({ error: "not_found" });
    } else if (customer && req.agent) {
      if (!req.agent.organizationId) return res.status(403).json({ error: "no_organization" });
      outreach = customer;
    } else if (organizationId && req.customerId) {
      const target = await Organization.findById(organizationId);
      if (!target) return res.status(404).json({ error: "organization_not_found" });
      if (target.approvalStatus === "suspended" || target.approvalStatus === "rejected") {
        return res.status(403).json({ error: "organization_blocked" });
      }
    } else {
      return res.status(400).json({ error: "conversationId_or_organizationId_required" });
    }

    const orgId = String(conversation?.organizationId ?? organizationId ?? req.agent?.organizationId);

    // Org checks run before anything is created, so a blocked/limited org leaves no trace.
    let organizationDoc = null;
    if (req.agent) {
      organizationDoc = await Organization.findById(orgId);
      if (!organizationDoc) return res.status(404).json({ error: "organization_not_found" });
      if (organizationDoc.approvalStatus === "suspended" || organizationDoc.approvalStatus === "rejected") {
        return res.status(403).json({ error: "organization_blocked" });
      }
    }

    // Attachment keys are scoped to a conversation, so they can only be sent
    // into an existing thread (new threads start with text).
    if (attachments?.length) {
      if (!conversation) return res.status(400).json({ error: "attachments_require_conversation" });
      const convId = String(conversation._id);
      for (const a of attachments) {
        const problem = findAttachmentProblem(a, orgId, convId);
        if (problem) return res.status(400).json({ error: problem });
      }
      const sizes = await Promise.all(attachments.map((a) => getObjectSize(a.s3Key)));
      if (sizes.some((size) => size === null)) {
        return res.status(400).json({ error: "attachment_not_uploaded" });
      }
      // Trust the stored object size, not the client-declared one.
      for (const [i, a] of attachments.entries()) {
        if (findAttachmentProblem({ ...a, sizeBytes: sizes[i]! }, orgId, convId)) {
          return res.status(400).json({ error: "attachment_too_large" });
        }
      }
    }

    let rateLimited = false;
    if (organizationDoc?.approvalStatus === "pending") {
      const allowed = await checkAndIncrementRateLimit(orgId);
      if (!allowed) return res.status(429).json({ error: "rate_limit_exceeded" });
      rateLimited = true;
    }

    try {
      let customerRegistered = true;
      if (!conversation) {
        let customerId: string;
        if (outreach) {
          const target = await resolveOrCreateCustomer(outreach.type, outreach.value);
          customerId = String(target._id);
          customerRegistered = Boolean(target.lastLoginAt);
        } else {
          customerId = req.customerId!;
        }
        const existing = await Conversation.findOne({ organizationId: orgId, customerId });
        conversation =
          existing ??
          (await Conversation.create({ organizationId: orgId, customerId }).catch(async (err) => {
            // Lost a race with a concurrent create: the unique index guarantees one thread per pair.
            if ((err as { code?: number }).code === 11000) {
              return Conversation.findOne({ organizationId: orgId, customerId });
            }
            throw err;
          }));
        conversationCreated = !existing;
        if (!conversation) throw new Error("conversation_create_failed");
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
      conversation.lastMessagePreview = text?.slice(0, 140) ?? "Attachment";
      await conversation.save();

      await fanOutNewMessage(conversation, message, { conversationCreated });

      if (outreach && conversationCreated && !customerRegistered && organizationDoc) {
        void notifyUnregisteredCustomer({
          type: outreach.type,
          value: outreach.value,
          organizationName: organizationDoc.name,
        });
      }

      const body: SendMessageResponse = { message: toMessageDto(message) };
      res.status(201).json(body);
    } catch (err) {
      // The send failed after a rate-limit slot was taken — give it back.
      if (rateLimited) await refundRateLimit(orgId).catch(() => {});
      throw err;
    }
  }),
);

/** Marks one message delivered/read. Only the recipient (the other party) may do this, and status never goes backwards. */
messagesRouter.post(
  "/messages/:id/status",
  resolveRequester,
  validateBody(updateMessageStatusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: "delivered" | "read" };
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: "not_found" });

    const { forbidden } = await loadAuthorizedConversation(req, String(message.conversationId));
    if (forbidden) return res.status(403).json({ error: "forbidden" });

    const requesterIsSender = req.agent
      ? message.senderType === "agent"
      : message.senderType === "customer";
    if (requesterIsSender) return res.status(403).json({ error: "cannot_update_own_message" });

    if (STATUS_RANK[status] > STATUS_RANK[message.status]) {
      message.status = status;
      const now = new Date();
      if (status === "delivered") message.deliveredAt = now;
      if (status === "read") {
        message.readAt = now;
        message.deliveredAt ??= now;
      }
      await message.save();
      await publish(
        conversationChannelName(String(message.conversationId)),
        "message.status",
        toMessageDto(message),
      ).catch(() => {});
    }

    res.json({ message: toMessageDto(message) });
  }),
);

/** Marks every unread message from the other party in a conversation as read. */
messagesRouter.post(
  "/conversations/:id/read",
  resolveRequester,
  asyncHandler(async (req, res) => {
    const { conversation, forbidden } = await loadAuthorizedConversation(req, req.params.id);
    if (forbidden) return res.status(403).json({ error: "forbidden" });
    if (!conversation) return res.status(404).json({ error: "not_found" });

    const otherParty = req.agent ? "customer" : "agent";
    const unread = await Message.find({
      conversationId: conversation._id,
      senderType: otherParty,
      status: { $ne: "read" },
    }).select("_id");
    const ids = unread.map((m) => m._id);

    if (ids.length) {
      const now = new Date();
      await Message.updateMany({ _id: { $in: ids } }, [
        { $set: { status: "read", readAt: now, deliveredAt: { $ifNull: ["$deliveredAt", now] } } },
      ]);
      await publish(conversationChannelName(String(conversation._id)), "messages.read", {
        conversationId: String(conversation._id),
        messageIds: ids.map(String),
        readAt: now.toISOString(),
      }).catch(() => {});
    }

    const body: MarkConversationReadResponse = { messageIds: ids.map(String) };
    res.json(body);
  }),
);
