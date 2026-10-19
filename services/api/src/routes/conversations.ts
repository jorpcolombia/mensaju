import { Router, type Router as ExpressRouter } from "express";
import { Conversation, Message, Organization } from "@messages/db";
import type {
  ListConversationsResponse,
  StartConversationRequest,
  StartConversationResponse,
} from "@messages/shared-types";
import { resolveRequester } from "../middleware/requester.js";
import { toConversationDto } from "../lib/dto.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateBody } from "../lib/validate.js";
import { listConversationsQuerySchema, startConversationSchema } from "../lib/schemas.js";

export const conversationsRouter: ExpressRouter = Router();

conversationsRouter.use(resolveRequester);

conversationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit, before } = listConversationsQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = req.agent
      ? { organizationId: req.agent.organizationId }
      : { customerId: req.customerId };
    if (before) filter.lastMessageAt = { $lt: new Date(before) };

    const page = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(limit + 1);
    const hasMore = page.length > limit;
    const conversations = page.slice(0, limit);

    // Unread = messages from the other party that the requester has not read.
    const otherParty = req.agent ? "customer" : "agent";
    const counts = await Message.aggregate<{ _id: unknown; count: number }>([
      {
        $match: {
          conversationId: { $in: conversations.map((c) => c._id) },
          senderType: otherParty,
          status: { $ne: "read" },
        },
      },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]);
    const unreadById = new Map(counts.map((c) => [String(c._id), c.count]));

    const last = conversations[conversations.length - 1];
    const body: ListConversationsResponse = {
      conversations: conversations.map((c) =>
        toConversationDto(c, unreadById.get(String(c._id)) ?? 0),
      ),
      nextCursor: hasMore && last?.lastMessageAt ? last.lastMessageAt.toISOString() : undefined,
    };
    res.json(body);
  }),
);

/** Customer-initiated: find-or-create the {organizationId, customerId} thread (plan §8/§11). */
conversationsRouter.post(
  "/",
  validateBody(startConversationSchema),
  asyncHandler(async (req, res) => {
    if (!req.customerId) {
      return res.status(403).json({ error: "customers_only" });
    }
    const { organizationId } = req.body as StartConversationRequest;

    const organization = await Organization.findById(organizationId);
    if (!organization) return res.status(404).json({ error: "organization_not_found" });
    if (organization.approvalStatus === "suspended" || organization.approvalStatus === "rejected") {
      return res.status(403).json({ error: "organization_blocked" });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { organizationId, customerId: req.customerId },
      { $setOnInsert: { organizationId, customerId: req.customerId } },
      { upsert: true, new: true },
    );

    const body: StartConversationResponse = { conversation: toConversationDto(conversation) };
    res.status(201).json(body);
  }),
);
