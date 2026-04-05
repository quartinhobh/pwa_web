// Pre-configured rate limiters (express-rate-limit).
// Consumed by routes in P3-A3 and later phases.

import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

const ONE_MINUTE_MS = 60 * 1000;

export const globalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: ONE_MINUTE_MS,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export const writeLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: ONE_MINUTE_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authGuestLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: ONE_MINUTE_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
