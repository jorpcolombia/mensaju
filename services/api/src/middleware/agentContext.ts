import type { NextFunction, Request, Response } from "express";
import { Agent, Admin } from "@messages/db";
import type { HydratedDocument } from "mongoose";
import type { AgentDoc, AdminDoc } from "@messages/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agent?: HydratedDocument<AgentDoc>;
      admin?: HydratedDocument<AdminDoc>;
    }
  }
}

/** Loads the `agents` doc for the verified Clerk user. Call after requireOrgSession(). */
export async function loadAgent(req: Request, res: Response, next: NextFunction) {
  const agent = await Agent.findOne({ clerkUserId: req.clerkUserId });
  if (!agent) {
    return res.status(403).json({ error: "no_agent_record" });
  }
  req.agent = agent;
  next();
}

/** Requires the loaded agent to belong to an organization (rejects unclaimed shells). */
export function requireOrganization(req: Request, res: Response, next: NextFunction) {
  if (!req.agent?.organizationId) {
    return res.status(403).json({ error: "no_organization" });
  }
  next();
}

export function requireAgentRole(...roles: AgentDoc["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.agent || !roles.includes(req.agent.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

/**
 * Loads (creating on first use) the `admins` doc for the verified Clerk user. The doc is
 * only a stable id for audit-log references; authority comes from `config/admins.ts`,
 * which requireAdminSession() already enforced.
 */
export async function loadAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const admin = await Admin.findOneAndUpdate(
      { clerkUserId: req.clerkUserId },
      { $setOnInsert: { clerkUserId: req.clerkUserId, displayName: req.clerkUserId } },
      { upsert: true, new: true },
    );
    req.admin = admin;
    next();
  } catch (err) {
    next(err);
  }
}
