import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "@clerk/backend";
import { env } from "../env.js";
import { verifyCustomerToken } from "../lib/customerSession.js";
import { isAdminUserId } from "../config/admins.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      clerkUserId?: string;
      customerId?: string;
    }
  }
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}

function clerkSessionMiddleware(secretKey: string | undefined) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token || !secretKey) {
      return res.status(401).json({ error: "unauthenticated" });
    }
    try {
      const { sub } = await verifyToken(token, { secretKey });
      req.clerkUserId = sub;
      next();
    } catch {
      res.status(401).json({ error: "invalid_session" });
    }
  };
}

/**
 * Verifies a Clerk session and attaches `req.clerkUserId`. Route handlers resolve
 * that to an internal `agents` doc (and its `organizationId`/`role`).
 */
export function requireOrgSession() {
  return clerkSessionMiddleware(env.clerkSecretKey);
}

/**
 * Verifies a Clerk session (same Clerk app as agents) and requires the user id to be
 * listed in `config/admins.ts`. Fails closed with 403 for everyone else.
 */
export function requireAdminSession() {
  const verify = clerkSessionMiddleware(env.clerkSecretKey);
  return (req: Request, res: Response, next: NextFunction) =>
    verify(req, res, () => {
      if (!isAdminUserId(req.clerkUserId)) {
        return res.status(403).json({ error: "not_admin" });
      }
      next();
    });
}

/** Verifies a backend-issued customer JWT (see plan §3 — customers are not Clerk users). */
export function requireCustomerSession() {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "unauthenticated" });
    }
    try {
      req.customerId = verifyCustomerToken(token);
      next();
    } catch {
      res.status(401).json({ error: "invalid_session" });
    }
  };
}
