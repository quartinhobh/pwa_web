// Lyrics routes — P3-C.
// GET /lyrics/:artist/:title — public, global rate limit.
// POST /lyrics/refresh — admin only, write rate limit, body { artist, title }.

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import { fetchLyrics } from '../services/lyricsService';

export const lyricsRouter: Router = Router();

lyricsRouter.get(
  '/:artist/:title',
  async (req: Request, res: Response) => {
    try {
      const result = await fetchLyrics(req.params.artist!, req.params.title!);
      res.status(200).json(result);
    } catch {
      res.status(200).json({ lyrics: null, source: null, cached: false });
    }
  },
);

lyricsRouter.post(
  '/refresh',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { artist?: unknown; title?: unknown };
    if (typeof body.artist !== 'string' || typeof body.title !== 'string') {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }
    try {
      const result = await fetchLyrics(body.artist, body.title, {
        skipCache: true,
      });
      res.status(200).json(result);
    } catch {
      res.status(500).json({ error: 'refresh_failed' });
    }
  },
);
