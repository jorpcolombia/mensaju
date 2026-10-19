import { Router, raw, type Router as ExpressRouter, type Request as ExpressRequest } from "express";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { Agent, Admin } from "@messages/db";
import { env } from "../env.js";

export const webhooksRouter: ExpressRouter = Router();

function toFetchRequest(req: ExpressRequest): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(","));
  }
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  return new Request(url, { method: req.method, headers, body: req.body as Buffer });
}

/**
 * `user.created` on the messages-org Clerk app creates a bare `agents`
 * shell doc (no organizationId yet — filled in by the create-org/accept-invite
 * flow). Requires the raw body for Standard Webhooks signature verification.
 */
webhooksRouter.post("/clerk-org", raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await verifyWebhook(toFetchRequest(req), {
      signingSecret: env.clerkOrgWebhookSigningSecret,
    });
    if (event.type === "user.created") {
      const clerkUserId = event.data.id;
      const displayName =
        [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") ||
        event.data.email_addresses?.[0]?.email_address ||
        clerkUserId;
      await Agent.findOneAndUpdate(
        { clerkUserId },
        { $setOnInsert: { clerkUserId, displayName, role: "member" } },
        { upsert: true },
      );
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "webhook_verification_failed", detail: (err as Error).message });
  }
});

/** Same as /clerk-org but against the fully separate messages-admin Clerk app. */
webhooksRouter.post("/clerk-admin", raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = await verifyWebhook(toFetchRequest(req), {
      signingSecret: env.clerkAdminWebhookSigningSecret,
    });
    if (event.type === "user.created") {
      const clerkUserId = event.data.id;
      // Fail closed: only allowlisted emails become admins, so open sign-ups on the
      // admin Clerk app can never grant admin access by themselves.
      const emails = (event.data.email_addresses ?? []).map((e) => e.email_address.toLowerCase());
      if (!emails.some((e) => env.adminAllowedEmails.includes(e))) {
        console.warn(`[webhook] admin signup ${clerkUserId} not in ADMIN_ALLOWED_EMAILS; ignoring`);
        return res.status(200).json({ ok: true });
      }
      const displayName =
        [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") ||
        event.data.email_addresses?.[0]?.email_address ||
        clerkUserId;
      await Admin.findOneAndUpdate(
        { clerkUserId },
        { $setOnInsert: { clerkUserId, displayName } },
        { upsert: true },
      );
    }
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "webhook_verification_failed", detail: (err as Error).message });
  }
});
