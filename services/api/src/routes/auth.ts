import { Router, type Router as ExpressRouter } from "express";
import { Customer, CustomerIdentifier } from "@messages/db";
import type {
  LinkIdentifierRequest,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  RequestOtpRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from "@messages/shared-types";
import { requireCustomerSession } from "../middleware/auth.js";
import { smsOtpProvider } from "../lib/otp/smsProvider.js";
import { whatsAppOtpProvider } from "../lib/otp/whatsappProvider.js";
import { issueCustomerToken } from "../lib/customerSession.js";
import {
  IdentifierConflictError,
  linkIdentifierToCustomer,
  normalizeIdentifier,
  resolveOrCreateCustomer,
} from "../lib/identity.js";
import { verifyOAuthToken, type OAuthProviderName } from "../lib/oauth.js";
import { toCustomerDto } from "../lib/dto.js";

export const authRouter: ExpressRouter = Router();

authRouter.post("/otp/request", async (req, res) => {
  const { channel, phone } = req.body as RequestOtpRequest;
  const phoneE164 = normalizeIdentifier("phone", phone);
  try {
    if (channel === "sms") {
      await smsOtpProvider.sendCode(phoneE164);
    } else {
      await whatsAppOtpProvider.sendCode(phoneE164);
    }
    res.status(202).json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "otp_send_failed", detail: (err as Error).message });
  }
});

authRouter.post("/otp/verify", async (req, res) => {
  const { phone, code } = req.body as VerifyOtpRequest;
  const phoneE164 = normalizeIdentifier("phone", phone);

  // Either channel may have been used to send the code; check both stores.
  const verified =
    (await smsOtpProvider.verifyCode(phoneE164, code)) ||
    (await whatsAppOtpProvider.verifyCode(phoneE164, code));

  if (!verified) {
    return res.status(401).json({ error: "invalid_code" });
  }

  const customer = await resolveOrCreateCustomer("phone", phoneE164);
  const token = issueCustomerToken(String(customer._id));
  const body: VerifyOtpResponse = { token, customer: toCustomerDto(customer) };
  res.json(body);
});

authRouter.post("/oauth/:provider/callback", async (req, res) => {
  const provider = req.params.provider as OAuthProviderName;
  const { providerToken } = req.body as OAuthCallbackRequest;

  let identity;
  try {
    identity = await verifyOAuthToken(provider, providerToken);
  } catch (err) {
    return res.status(401).json({ error: "invalid_provider_token", detail: (err as Error).message });
  }

  // Prefer resolving by email when the provider supplies one (Google/Facebook);
  // fall back to the opaque provider id (e.g. Apple private relay) — plan §3.
  let customer = identity.email
    ? await (async () => {
        const existing = await CustomerIdentifier.findOne({
          type: "email",
          value: normalizeIdentifier("email", identity.email!),
        });
        return existing ? Customer.findById(existing.customerId) : null;
      })()
    : null;

  if (!customer) {
    customer = await Customer.findOne({
      authProviders: { $elemMatch: { provider, providerUserId: identity.providerUserId } },
    });
  }

  if (!customer) {
    customer = identity.email
      ? await resolveOrCreateCustomer("email", identity.email)
      : await Customer.create({ authProviders: [] });
  }

  const alreadyLinked = customer.authProviders.some(
    (p) => p.provider === provider && p.providerUserId === identity.providerUserId,
  );
  if (!alreadyLinked) {
    customer.authProviders.push({
      provider,
      providerUserId: identity.providerUserId,
      linkedAt: new Date(),
    });
    await customer.save();
  }

  const token = issueCustomerToken(String(customer._id));
  const body: OAuthCallbackResponse = { token, customer: toCustomerDto(customer) };
  res.json(body);
});

authRouter.post("/identity/link", requireCustomerSession(), async (req, res) => {
  const { type, value } = req.body as LinkIdentifierRequest;
  try {
    await linkIdentifierToCustomer(req.customerId!, type, value);
    res.status(204).end();
  } catch (err) {
    if (err instanceof IdentifierConflictError) {
      return res.status(409).json({ error: "identifier_conflict" });
    }
    throw err;
  }
});
