import { redis } from "./redis.js";

// INCR + EXPIRE in one atomic step so a crash between the two can't leave a
// counter that never expires.
const INCR_WITH_TTL = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

/** Increments a Redis counter, starting its TTL window on first use; returns the new count. */
export async function incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
  return (await redis.eval(INCR_WITH_TTL, 1, key, ttlSeconds)) as number;
}
