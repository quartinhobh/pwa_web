// Auth routes — P3-A3.
// POST /auth/guest  — creates an anonymous session.
// POST /auth/link   — links a guest session to an authenticated user (Bearer ID token).

import { Router, type Request, type Response } from 'express';
import { requireAuthAllowUnverified } from '../middleware/auth';
import { authGuestLimiter } from '../middleware/rateLimit';
import { adminDb } from '../config/firebase';
import {
  createGuestSession,
  linkSessionToUser,
} from '../services/sessionService';
import type { UserRole } from '../types';

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
  requireAuthAllowUnverified,
  async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    try {
      let sessionId =
        typeof req.body?.sessionId === 'string' ? req.body.sessionId : null;
      if (!sessionId) {
        const session = await createGuestSession();
        sessionId = session.id;
      }
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

// GET /auth/me — returns the authenticated user's profile.
// Reads users/{uid}; if the doc does not exist yet (e.g. first call before
// /auth/link), returns a safe default with role='guest'.
authRouter.get(
  '/me',
  requireAuthAllowUnverified,
  async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    try {
      const uid = req.user.uid;
      const snap = await adminDb.collection('users').doc(uid).get();
      const data = snap.exists
        ? (snap.data() as {
            email?: string | null;
            displayName?: string;
            role?: UserRole;
            username?: string | null;
            avatarUrl?: string | null;
            bio?: string | null;
            socialLinks?: { platform: string; url: string }[];
            favoriteAlbums?: { mbId: string; title: string; artistCredit: string; coverUrl: string | null }[];
          })
        : undefined;
      res.status(200).json({
        userId: uid,
        email: data?.email ?? req.user.email ?? null,
        displayName:
          data?.displayName ??
          ((req.user.name as string | undefined) ?? 'Guest'),
        role: (data?.role ?? 'guest') as UserRole,
        username: data?.username ?? null,
        avatarUrl: data?.avatarUrl ?? null,
        bio: data?.bio ?? null,
        socialLinks: data?.socialLinks ?? [],
        favoriteAlbums: data?.favoriteAlbums ?? [],
      });
    } catch {
      res.status(500).json({ error: 'me_failed' });
    }
  },
);
