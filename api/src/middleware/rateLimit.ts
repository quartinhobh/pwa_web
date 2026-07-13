// Pre-configured rate limiters (express-rate-limit).
// Consumed by routes in P3-A3 and later phases.

import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

const ONE_MINUTE_MS = 60 * 1000;

// In emulator/dev mode the limits collapse development velocity — E2E suites
// can easily trip them. `skip: true` short-circuits the middleware while
// keeping the same handler shape in production.
const EMULATOR_MODE =
  process.env.NODE_ENV !== 'production' &&
  (!!process.env.FIRESTORE_EMULATOR_HOST ||
   !!process.env.FIREBASE_AUTH_EMULATOR_HOST);

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

// Guest (unauthenticated) RSVP submissions — per IP, 100/hour.
// Generous because guests at the venue share a NAT/carrier IP, so the whole
// event (~100 people) can hit the same counter. Still caps runaway spam.
export const guestRsvpLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * ONE_MINUTE_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});

// Anonymous bar suggestion submissions — per IP, 3/hour.
// Applied only when req.user is null on POST /suggestions/bars.
export const anonymousSuggestionLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * ONE_MINUTE_MS,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});
