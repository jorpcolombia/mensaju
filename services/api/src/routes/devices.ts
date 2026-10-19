import { Router, type Router as ExpressRouter } from "express";
import { Device } from "@messages/db";
import type { RegisterDeviceRequest } from "@messages/shared-types";
import { resolveRequester } from "../middleware/requester.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { validateBody } from "../lib/validate.js";
import { registerDeviceSchema } from "../lib/schemas.js";

export const devicesRouter: ExpressRouter = Router();

devicesRouter.use(resolveRequester);

/** Registers (or re-assigns) a push token for the signed-in agent or customer. */
devicesRouter.post(
  "/register",
  validateBody(registerDeviceSchema),
  asyncHandler(async (req, res) => {
    const { platform, token } = req.body as RegisterDeviceRequest;
    const owner = req.agent
      ? { ownerType: "agent" as const, ownerId: req.agent._id, organizationId: req.agent.organizationId }
      : { ownerType: "customer" as const, ownerId: req.customerId, organizationId: undefined };

    // A token belongs to one device at a time; if the phone changed hands, it follows the latest sign-in.
    await Device.findOneAndUpdate({ token }, { ...owner, platform, token }, { upsert: true });
    res.json({ ok: true });
  }),
);

devicesRouter.post(
  "/unregister",
  validateBody(registerDeviceSchema.pick({ token: true })),
  asyncHandler(async (req, res) => {
    const { token } = req.body as { token: string };
    const ownerId = req.agent ? req.agent._id : req.customerId;
    await Device.deleteOne({ token, ownerId });
    res.json({ ok: true });
  }),
);
