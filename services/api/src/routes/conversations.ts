import { Router, type Router as ExpressRouter } from "express";
import { Conversation, Organization } from "@messages/db";
import type {
  ListConversationsResponse,
  StartConversationRequest,
  StartConversationResponse,
} from "@messages/shared-types";
import { resolveRequester } from "../middleware/requester.js";
import { toConversationDto } from "../lib/dto.js";

export const conversationsRouter: ExpressRouter = Router();

conversationsRouter.use(resolveRequester);

conversationsRouter.get("/", async (req, res) => {
  const filter = req.agent
    ? { organizationId: req.agent.organizationId }
    : { customerId: req.customerId };

  const conversations = await Conversation.find(filter).sort({ lastMessageAt: -1 });
  const body: ListConversationsResponse = { conversations: conversations.map(toConversationDto) };
  res.json(body);
});

/** Customer-initiated: find-or-create the {organizationId, customerId} thread (plan §8/§11). */
conversationsRouter.post("/", async (req, res) => {
  if (!req.customerId) {
    return res.status(403).json({ error: "customers_only" });
  }
  const { organizationId } = req.body as StartConversationRequest;

  const organization = await Organization.findById(organizationId);
  if (!organization) return res.status(404).json({ error: "organization_not_found" });

  const conversation = await Conversation.findOneAndUpdate(
    { organizationId, customerId: req.customerId },
    { $setOnInsert: { organizationId, customerId: req.customerId } },
    { upsert: true, new: true },
  );

  const body: StartConversationResponse = { conversation: toConversationDto(conversation) };
  res.status(201).json(body);
});
