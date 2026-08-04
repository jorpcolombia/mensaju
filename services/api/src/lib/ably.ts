import Ably from "ably";
import { required } from "../env.js";

let restClient: Ably.Rest | undefined;

function client(): Ably.Rest {
  if (!restClient) {
    restClient = new Ably.Rest({ key: required("ABLY_API_KEY") });
  }
  return restClient;
}

export function conversationChannelName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function orgNotificationsChannelName(organizationId: string): string {
  return `org:${organizationId}:notifications`;
}

export async function publish(channelName: string, eventName: string, data: unknown) {
  await client().channels.get(channelName).publish(eventName, data);
}

/**
 * Issues a short-TTL Ably TokenRequest scoped to exactly the channels the
 * caller is authorized for (plan §4). Agents get their org's whole channel
 * namespace; customers get only their own conversation channels.
 */
export async function createAblyTokenRequest(params: {
  clientId: string;
  capability: Record<string, string[]>;
}) {
  return client().auth.createTokenRequest({
    clientId: params.clientId,
    capability: JSON.stringify(params.capability),
    ttl: 60 * 60 * 1000,
  });
}
