import { Router, type Router as ExpressRouter } from "express";
import { Organization, ApprovalAuditLog } from "@messages/db";
import type {
  ApprovalAction,
  ListPendingOrganizationsResponse,
  OrganizationApprovalActionRequest,
} from "@messages/shared-types";
import { requireAdminSession } from "../middleware/auth.js";
import { loadAdmin } from "../middleware/agentContext.js";
import { toAuditLogDto, toOrganizationDto } from "../lib/dto.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateBody } from "../lib/validate.js";
import { organizationApprovalActionSchema } from "../lib/schemas.js";

export const adminRouter: ExpressRouter = Router();

adminRouter.use(requireAdminSession(), loadAdmin);

adminRouter.get(
  "/organizations",
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const filter = status ? { approvalStatus: status } : {};
    const organizations = await Organization.find(filter).sort({ createdAt: -1 });
    const body: ListPendingOrganizationsResponse = {
      organizations: organizations.map(toOrganizationDto),
    };
    res.json(body);
  }),
);

adminRouter.get(
  "/organizations/:id",
  asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: "not_found" });
    res.json({ organization: toOrganizationDto(organization) });
  }),
);

adminRouter.get(
  "/organizations/:id/audit-log",
  asyncHandler(async (req, res) => {
    const entries = await ApprovalAuditLog.find({ organizationId: req.params.id }).sort({
      createdAt: -1,
    });
    res.json({ entries: entries.map(toAuditLogDto) });
  }),
);

const ACTION_TARGET_STATUS: Record<ApprovalAction, string> = {
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
  reinstate: "pending",
};

function approvalAction(action: ApprovalAction) {
  return asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.params.id);
    if (!organization) return res.status(404).json({ error: "not_found" });

    const { note } = req.body as OrganizationApprovalActionRequest;
    const previousStatus = organization.approvalStatus;
    const newStatus = ACTION_TARGET_STATUS[action] as typeof organization.approvalStatus;

    organization.approvalStatus = newStatus;
    if (action === "approve") {
      organization.approvedAt = new Date();
      organization.approvedBy = req.admin!._id;
    }
    await organization.save();

    await ApprovalAuditLog.create({
      organizationId: organization._id,
      adminId: req.admin!._id,
      action,
      previousStatus,
      newStatus,
      note,
    });

    res.json({ organization: toOrganizationDto(organization) });
  });
}

adminRouter.post(
  "/organizations/:id/approve",
  validateBody(organizationApprovalActionSchema),
  approvalAction("approve"),
);
adminRouter.post(
  "/organizations/:id/reject",
  validateBody(organizationApprovalActionSchema),
  approvalAction("reject"),
);
adminRouter.post(
  "/organizations/:id/suspend",
  validateBody(organizationApprovalActionSchema),
  approvalAction("suspend"),
);
adminRouter.post(
  "/organizations/:id/reinstate",
  validateBody(organizationApprovalActionSchema),
  approvalAction("reinstate"),
);
