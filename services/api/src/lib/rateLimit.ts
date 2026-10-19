import { redis } from "./redis.js";
import { incrWithTtl } from "./counter.js";

const WINDOW_SECONDS = 60 * 60;
const UNAPPROVED_LIMIT = 20;

function key(organizationId: string): string {
  return `ratelimit:org:${organizationId}`;
}

/**
 * Fixed-window counter, scoped per-organization overall (confirmed, plan §5).
 * Returns true if the org is still under the cap and the message should be
 * allowed; increments the counter as a side effect.
 */
export async function checkAndIncrementRateLimit(organizationId: string): Promise<boolean> {
  const count = await incrWithTtl(key(organizationId), WINDOW_SECONDS);
  return count <= UNAPPROVED_LIMIT;
}

/** Gives back a slot taken by checkAndIncrementRateLimit when the send ultimately failed. */
export async function refundRateLimit(organizationId: string): Promise<void> {
  await redis.decr(key(organizationId));
}
