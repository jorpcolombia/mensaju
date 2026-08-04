import { Router, type Router as ExpressRouter } from "express";
import { Types } from "mongoose";
import type { AcceptAgentInviteRequest, AcceptAgentInviteResponse } from "@messages/shared-types";
import { requireOrgSession } from "../middleware/auth.js";
import { loadAgent } from "../middleware/agentContext.js";
import { consumeAgentInvite } from "../lib/inviteStore.js";
import { toAgentDto } from "../lib/dto.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateBody } from "../lib/validate.js";
import { acceptAgentInviteSchema } from "../lib/schemas.js";

export const agentsRouter: ExpressRouter = Router();

agentsRouter.get(
  "/me",
  requireOrgSession(),
  loadAgent,
  asyncHandler(async (req, res) => {
    res.json({ agent: toAgentDto(req.agent!) });
  }),
);

/**
 * Links a newly-created plain Clerk account (the invitee) to the
 * organizationId/role from an outstanding invite. Not a Clerk org
 * membership — see plan §3.
 */
agentsRouter.post(
  "/accept-invite",
  requireOrgSession(),
  loadAgent,
  validateBody(acceptAgentInviteSchema),
  asyncHandler(async (req, res) => {
    if (req.agent!.organizationId) {
      return res.status(409).json({ error: "agent_already_in_organization" });
    }
    const { inviteId } = req.body as AcceptAgentInviteRequest;
    const invite = await consumeAgentInvite(inviteId);
    if (!invite) {
      return res.status(410).json({ error: "invite_expired_or_invalid" });
    }

    req.agent!.organizationId = new Types.ObjectId(invite.organizationId);
    req.agent!.role = invite.role;
    await req.agent!.save();

    const body: AcceptAgentInviteResponse = { agent: toAgentDto(req.agent!) };
    res.json(body);
  }),
);
