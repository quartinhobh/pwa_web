// Auth middleware — verifies Firebase ID tokens.
// Owner: architect (contract). Implementation stays minimal per P3-A1.

import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../config/firebase';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    // Enforce email verification for password-provider sign-ins.
    // OAuth providers (google.com, apple.com) always return verified emails,
    // so they pass through. Test-only decision: no grandfather window —
    // existing unverified password accounts must verify to continue.
    const provider = decoded.firebase?.sign_in_provider;
    if (provider === 'password' && decoded.email_verified === false) {
      res.status(401).json({ error: 'email_not_verified' });
      return;
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

/**
 * Auth that accepts unverified email. Use ONLY for endpoints that must work
 * during the signup/pre-verification flow — /auth/link and /auth/me — so the
 * client can bootstrap its session and render the "verify your email" banner.
 * All other routes should use requireAuth.
 */
export async function requireAuthAllowUnverified(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  try {
    req.user = await adminAuth.verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  if (!token) {
    next();
    return;
  }
  try {
    req.user = await adminAuth.verifyIdToken(token);
  } catch {
    // swallow — optional
  }
  next();
}
