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
    req.user = decoded;
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
