// Pre-configured rate limiters (express-rate-limit).
// Consumed by routes in P3-A3 and later phases.

import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

const ONE_MINUTE_MS = 60 * 1000;

// In emulator/dev mode the limits collapse development velocity — E2E suites
// can easily trip them. `skip: true` short-circuits the middleware while
// keeping the same handler shape in production.
const EMULATOR_MODE =
  !!process.env.FIRESTORE_EMULATOR_HOST ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

const skip = EMULATOR_MODE ? () => true : undefined;

export const globalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: ONE_MINUTE_MS,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

export const writeLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: ONE_MINUTE_MS,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

export const authGuestLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: ONE_MINUTE_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});
