import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "./redis.js";

function redisStore(prefix: string) {
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as Promise<any>,
  });
}

/** Per-IP limiter for unauthenticated auth endpoints (OTP request/verify, OAuth callback) — these are prime brute-force/spam targets. */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("ratelimit:auth:"),
});

/** Looser per-IP limiter for the rest of the API, as a baseline abuse guard. */
export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore("ratelimit:general:"),
});
