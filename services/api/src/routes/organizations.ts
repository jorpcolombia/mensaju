import { Router, type Router as ExpressRouter } from "express";
import { Organization } from "@messages/db";
import type {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  InviteAgentRequest,
  InviteAgentResponse,
  ListOrganizationDirectoryResponse,
  UpdateOrganizationProfileRequest,
  UpdateOrganizationProfileResponse,
} from "@messages/shared-types";
import { requireOrgSession } from "../middleware/auth.js";
import { loadAgent, requireAgentRole } from "../middleware/agentContext.js";
import { createAgentInvite } from "../lib/inviteStore.js";
import { sendAgentInviteEmail } from "../lib/email.js";
import { toOrganizationDto, toAgentDto } from "../lib/dto.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateBody } from "../lib/validate.js";
import {
  createOrganizationSchema,
  inviteAgentSchema,
  updateOrganizationProfileSchema,
} from "../lib/schemas.js";

export const organizationsRouter: ExpressRouter = Router();

/**
 * Creates an org and claims the requesting (already-shell) agent as its
 * owner. Clerk Organizations are not used (plan §3) — this is entirely our
 * own grouping.
 */
organizationsRouter.post(
  "/",
  requireOrgSession(),
  loadAgent,
  validateBody(createOrganizationSchema),
  asyncHandler(async (req, res) => {
    if (req.agent!.organizationId) {
      return res.status(409).json({ error: "agent_already_in_organization" });
    }
    const { name } = req.body as CreateOrganizationRequest;

    const organization = await Organization.create({ name, approvalStatus: "pending" });
    req.agent!.organizationId = organization._id;
    req.agent!.role = "owner";
    await req.agent!.save();

    const body: CreateOrganizationResponse = {
      organization: toOrganizationDto(organization),
      agent: toAgentDto(req.agent!),
    };
    res.status(201).json(body);
  }),
);

organizationsRouter.post(
  "/:id/agents/invite",
  requireOrgSession(),
  loadAgent,
  requireAgentRole("owner", "admin"),
  validateBody(inviteAgentSchema),
  asyncHandler(async (req, res) => {
    if (String(req.agent!.organizationId) !== req.params.id) {
      return res.status(403).json({ error: "forbidden" });
    }
    const { email, role } = req.body as InviteAgentRequest;
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: "not_found" });

    const inviteId = await createAgentInvite({
      organizationId: req.params.id,
      role,
      email,
    });
    await sendAgentInviteEmail({ to: email, organizationName: organization.name, inviteId });

    const body: InviteAgentResponse = { inviteId };
    res.status(201).json(body);
  }),
);

/** Browsable directory of approved (verified) orgs a customer can start a conversation with. Must precede "/:id". */
organizationsRouter.get(
  "/directory",
  asyncHandler(async (_req, res) => {
    const organizations = await Organization.find({ approvalStatus: "approved" })
      .select("_id name description websiteUrl")
      .lean();
    const body: ListOrganizationDirectoryResponse = {
      organizations: organizations.map((o) => ({
        id: String(o._id),
        name: o.name,
        description: o.description,
        websiteUrl: o.websiteUrl,
      })),
    };
    res.json(body);
  }),
);

/**
 * Updates an org's public profile (name, description, website). Approved
 * ("verified") orgs show these fields in the customer-facing directory.
 */
organizationsRouter.patch(
  "/:id",
  requireOrgSession(),
  loadAgent,
  requireAgentRole("owner", "admin"),
  validateBody(updateOrganizationProfileSchema),
  asyncHandler(async (req, res) => {
    if (String(req.agent!.organizationId) !== req.params.id) {
      return res.status(403).json({ error: "forbidden" });
    }
    const { name, description, websiteUrl } = req.body as UpdateOrganizationProfileRequest;
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: "not_found" });

    if (name !== undefined) organization.name = name;
    if (description !== undefined) organization.description = description;
    if (websiteUrl !== undefined) organization.websiteUrl = websiteUrl;
    await organization.save();

    const body: UpdateOrganizationProfileResponse = {
      organization: toOrganizationDto(organization),
    };
    res.json(body);
  }),
);

/** Fetches an org's own full profile (own agents only). */
organizationsRouter.get(
  "/:id",
  requireOrgSession(),
  loadAgent,
  asyncHandler(async (req, res) => {
    if (String(req.agent!.organizationId) !== req.params.id) {
      return res.status(403).json({ error: "forbidden" });
    }
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: "not_found" });

    res.json({ organization: toOrganizationDto(organization) });
  }),
);

