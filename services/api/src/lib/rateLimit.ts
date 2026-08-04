import { redis } from "./redis.js";

const WINDOW_SECONDS = 60 * 60;
const UNAPPROVED_LIMIT = 20;

/**
 * Fixed-window counter, scoped per-organization overall (confirmed, plan §5).
 * Returns true if the org is still under the cap and the message should be
 * allowed; increments the counter as a side effect.
 */
export async function checkAndIncrementRateLimit(organizationId: string): Promise<boolean> {
  const key = `ratelimit:org:${organizationId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  return count <= UNAPPROVED_LIMIT;
}
