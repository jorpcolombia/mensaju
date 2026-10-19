import { Device } from "@messages/db";
import type { Types } from "mongoose";
import { InvalidPushTokenError } from "./pushTransports.js";

export interface PushPayload {
  title: string;
  body: string;
  data: { conversationId: string };
}

/**
 * Delivery transport for FCM (Android) / APNs (iOS). Swap the default for a
 * real implementation once the Firebase / Apple credentials exist; callers
 * only depend on this interface.
 */
export interface PushTransport {
  send(device: { platform: "ios" | "android"; token: string }, payload: PushPayload): Promise<void>;
}

class LoggingPushTransport implements PushTransport {
  async send(device: { platform: string; token: string }, payload: PushPayload) {
    console.log(`[push:${device.platform}] ${device.token.slice(0, 8)}… ${payload.title}: ${payload.body}`);
  }
}

let transport: PushTransport = new LoggingPushTransport();

export function setPushTransport(next: PushTransport): void {
  transport = next;
}

async function sendToDevices(
  filter: Record<string, unknown>,
  payload: PushPayload,
): Promise<void> {
  const devices = await Device.find(filter);
  await Promise.allSettled(
    devices.map(async (d) => {
      try {
        await transport.send({ platform: d.platform, token: d.token }, payload);
      } catch (err) {
        if (err instanceof InvalidPushTokenError) {
          // The provider says this token is dead (app uninstalled or token rotated).
          await Device.deleteOne({ _id: d._id });
        } else {
          console.error("[push] send failed", err);
        }
      }
    }),
  );
}

export function pushToCustomer(customerId: Types.ObjectId | string, payload: PushPayload) {
  return sendToDevices({ ownerType: "customer", ownerId: customerId }, payload);
}

export function pushToOrganization(organizationId: Types.ObjectId | string, payload: PushPayload) {
  return sendToDevices({ ownerType: "agent", organizationId }, payload);
}
