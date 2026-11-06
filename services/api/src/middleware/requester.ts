import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "@clerk/backend";
import { Agent } from "@messages/db";
import { env } from "../env.js";
import { verifyCustomerToken } from "../lib/customerSession.js";

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}

/**
 * Conversations/messages/Ably-token endpoints are shared between the
 * org/agent surface and the customer surface (plan §8). This middleware
 * accepts either a Clerk session or a customer JWT and sets
 * exactly one of req.agent / req.customerId.
 */
export async function resolveRequester(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "unauthenticated" });
  }

  if (env.clerkSecretKey) {
    try {
      const { sub } = await verifyToken(token, { secretKey: env.clerkSecretKey });
      const agent = await Agent.findOne({ clerkUserId: sub });
      if (agent) {
        req.clerkUserId = sub;
        req.agent = agent;
        return next();
      }
    } catch {
      // fall through to customer-token attempt
    }
  }

  try {
    req.customerId = verifyCustomerToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "invalid_session" });
  }
}
