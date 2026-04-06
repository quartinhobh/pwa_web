// Moderation routes — P3-F.
// mod/admin: delete messages, ban, list bans
// admin only: unban, list logs

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import { adminDb } from '../config/firebase';
import {
  banUser,
  deleteMessage,
  listBans,
  listLogs,
  unbanUser,
} from '../services/moderationService';

export const moderationRouter: Router = Router();

moderationRouter.post(
  '/chat/:eventId/delete',
  writeLimiter,
  requireAuth,
  requireRole('moderator', 'admin'),
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { messageId?: unknown; reason?: unknown };
    if (typeof body.messageId !== 'string' || body.messageId.length === 0) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }
    const reason =
      typeof body.reason === 'string' && body.reason.length > 0
        ? body.reason
        : null;
    try {
      await deleteMessage(
        req.params.eventId!,
        body.messageId,
        req.user!.uid,
        reason,
      );
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'delete_failed' });
    }
  },
);

moderationRouter.post(
  '/ban',
  writeLimiter,
  requireAuth,
  requireRole('moderator', 'admin'),
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      userId?: unknown;
      eventId?: unknown;
      reason?: unknown;
    };
    if (typeof body.userId !== 'string' || body.userId.length === 0) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }
    const eventId =
      typeof body.eventId === 'string' && body.eventId.length > 0
        ? body.eventId
        : null;
    const reason =
      typeof body.reason === 'string' && body.reason.length > 0
        ? body.reason
        : null;
    try {
      const ban = await banUser(body.userId, req.user!.uid, eventId, reason);
      res.status(200).json({ ban });
    } catch {
      res.status(500).json({ error: 'ban_failed' });
    }
  },
);

moderationRouter.delete(
  '/ban/:userId',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      await unbanUser(req.params.userId!, req.user!.uid);
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'unban_failed' });
    }
  },
);

moderationRouter.get(
  '/bans',
  requireAuth,
  requireRole('moderator', 'admin'),
  async (_req: Request, res: Response) => {
    try {
      const bans = await listBans();
      res.status(200).json({ bans });
    } catch {
      res.status(500).json({ error: 'list_bans_failed' });
    }
  },
);

// GET /moderation/users/:id — lookup a user doc (admin/moderator).
moderationRouter.get(
  '/users/:id',
  requireAuth,
  requireRole('moderator', 'admin'),
  async (req: Request, res: Response) => {
    try {
      const snap = await adminDb.collection('users').doc(req.params.id!).get();
      if (!snap.exists) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      res.status(200).json({
        userId: snap.id,
        displayName: data.displayName ?? null,
        email: data.email ?? null,
        role: data.role ?? 'guest',
      });
    } catch {
      res.status(500).json({ error: 'user_lookup_failed' });
    }
  },
);

moderationRouter.get(
  '/logs',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const limit = Math.min(
      Math.max(Number(req.query.limit ?? 50) || 50, 1),
      200,
    );
    const cursorRaw = req.query.cursor;
    const cursor =
      typeof cursorRaw === 'string' && cursorRaw.length > 0
        ? Number(cursorRaw)
        : undefined;
    try {
      const logs = await listLogs(
        limit,
        Number.isFinite(cursor as number) ? (cursor as number) : undefined,
      );
      res.status(200).json({ logs });
    } catch {
      res.status(500).json({ error: 'list_logs_failed' });
    }
  },
);
