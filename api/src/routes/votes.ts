// Vote routes — P3-D.
// POST /votes/:eventId        — auth, writeLimiter, body { favoriteTrackId, leastLikedTrackId }
// GET  /votes/:eventId        — public, globalLimiter (mounted app-wide)
// GET  /votes/:eventId/user   — auth, current user's UserVote or null

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimit';
import { getTallies, getUserVote, submitVote } from '../services/voteService';

export const votesRouter: Router = Router();

votesRouter.get('/:eventId', async (req: Request, res: Response) => {
  try {
    const tallies = await getTallies(req.params.eventId!);
    res.status(200).json(tallies);
  } catch {
    res.status(500).json({ error: 'tallies_failed' });
  }
});

votesRouter.get(
  '/:eventId/user',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const vote = await getUserVote(req.params.eventId!, req.user!.uid);
      res.status(200).json({ vote });
    } catch {
      res.status(500).json({ error: 'user_vote_failed' });
    }
  },
);

votesRouter.post(
  '/:eventId',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      favoriteTrackId?: unknown;
      leastLikedTrackId?: unknown;
    };
    if (
      typeof body.favoriteTrackId !== 'string' ||
      typeof body.leastLikedTrackId !== 'string' ||
      body.favoriteTrackId.length === 0 ||
      body.leastLikedTrackId.length === 0
    ) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }
    if (body.favoriteTrackId === body.leastLikedTrackId) {
      res.status(400).json({ error: 'duplicate_track' });
      return;
    }
    try {
      const tallies = await submitVote(req.params.eventId!, req.user!.uid, {
        favoriteTrackId: body.favoriteTrackId,
        leastLikedTrackId: body.leastLikedTrackId,
      });
      res.status(200).json(tallies);
    } catch {
      res.status(500).json({ error: 'submit_failed' });
    }
  },
);
