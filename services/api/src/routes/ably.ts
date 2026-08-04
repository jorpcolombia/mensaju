import { Router, type Router as ExpressRouter } from "express";
import { Conversation } from "@messages/db";
import type { AblyTokenResponse } from "@messages/shared-types";
import { resolveRequester } from "../middleware/requester.js";
import { createAblyTokenRequest } from "../lib/ably.js";
import { asyncHandler } from "../lib/asyncHandler.js";

export const ablyRouter: ExpressRouter = Router();

ablyRouter.use(resolveRequester);

ablyRouter.post(
  "/token",
  asyncHandler(async (req, res) => {
  let clientId: string;
  let capability: Record<string, string[]>;

  if (req.agent) {
    clientId = `agent:${req.agent._id}`;
    capability = {
      [`org:${req.agent.organizationId}:notifications`]: ["subscribe"],
    };
    // Channel names carry only the conversation id (plan §4), so scoping to
    // "this org's conversations" means enumerating them explicitly rather
    // than a wildcard — a wildcard here would leak other orgs' channels.
    const conversations = await Conversation.find({
      organizationId: req.agent.organizationId,
    }).select("_id");
    for (const c of conversations) {
      capability[`conversation:${c._id}`] = ["subscribe", "publish", "presence"];
    }
  } else {
    clientId = `customer:${req.customerId}`;
    const conversations = await Conversation.find({ customerId: req.customerId }).select("_id");
    capability = {};
    for (const c of conversations) {
      capability[`conversation:${c._id}`] = ["subscribe", "publish", "presence"];
    }
  }

  const tokenRequest = await createAblyTokenRequest({ clientId, capability });
  res.json(tokenRequest as unknown as AblyTokenResponse);
  }),
);
