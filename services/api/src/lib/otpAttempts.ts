import { redis } from "./redis.js";
import { incrWithTtl } from "./counter.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

function key(phoneE164: string): string {
  return `otp:failed:${phoneE164}`;
}

/** True once a phone number has burned its failed-verification budget; blocks guessing a 6-digit code. */
export async function isOtpLockedOut(phoneE164: string): Promise<boolean> {
  const count = Number((await redis.get(key(phoneE164))) ?? 0);
  return count >= MAX_FAILED_ATTEMPTS;
}

export async function recordFailedOtpAttempt(phoneE164: string): Promise<void> {
  await incrWithTtl(key(phoneE164), LOCKOUT_SECONDS);
}

export async function clearOtpAttempts(phoneE164: string): Promise<void> {
  await redis.del(key(phoneE164));
}
