import { randomUUID } from "node:crypto";
import { redis } from "./redis.js";
import type { AgentRole } from "@messages/shared-types";

const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

interface AgentInvite {
  organizationId: string;
  role: AgentRole;
  email: string;
}

function inviteKey(inviteId: string): string {
  return `invite:agent:${inviteId}`;
}

export async function createAgentInvite(invite: AgentInvite): Promise<string> {
  const inviteId = randomUUID();
  await redis.set(inviteKey(inviteId), JSON.stringify(invite), "EX", INVITE_TTL_SECONDS);
  return inviteId;
}

export async function consumeAgentInvite(inviteId: string): Promise<AgentInvite | null> {
  const key = inviteKey(inviteId);
  // GETDEL so two concurrent accepts cannot both consume the same invite.
  const raw = await redis.getdel(key);
  if (!raw) return null;
  return JSON.parse(raw) as AgentInvite;
}
