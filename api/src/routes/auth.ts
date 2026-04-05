// Auth routes — P3-A3.
// POST /auth/guest  — creates an anonymous session.
// POST /auth/link   — links a guest session to an authenticated user (Bearer ID token).

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { authGuestLimiter } from '../middleware/rateLimit';
import {
  createGuestSession,
  linkSessionToUser,
} from '../services/sessionService';

export const authRouter: Router = Router();

authRouter.post(
  '/guest',
  authGuestLimiter,
  async (_req: Request, res: Response) => {
    try {
      const session = await createGuestSession();
      res.status(200).json({
        sessionId: session.id,
        guestName: session.guestName,
        type: session.type,
      });
    } catch {
      res.status(500).json({ error: 'guest_session_failed' });
    }
  },
);

authRouter.post(
  '/link',
  requireAuth,
  async (req: Request, res: Response) => {
    const sessionId =
      typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;
    if (!sessionId) {
      res.status(400).json({ error: 'missing_sessionId' });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    try {
      const result = await linkSessionToUser(
        sessionId,
        req.user.uid,
        req.user.email ?? null,
        (req.user.name as string | undefined) ?? null,
      );
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'session_not_found') {
        res.status(404).json({ error: 'session_not_found' });
        return;
      }
      res.status(500).json({ error: 'link_failed' });
    }
  },
);
