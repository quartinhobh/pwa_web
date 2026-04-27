// Suggestions routes — bar and album suggestions, feedback, and comments.

import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter, anonymousSuggestionLimiter } from '../middleware/rateLimit';
import * as barSvc from '../services/barSuggestionService';
import * as albumSvc from '../services/albumSuggestionService';
import * as feedbackSvc from '../services/barFeedbackService';
import * as commentSvc from '../services/suggestionCommentService';
import type { SuggestionStatus } from '../types';

const router = Router();

const VALID_STATUSES: SuggestionStatus[] = ['suggested', 'liked', 'disliked'];

function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
  res: Response,
): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    middleware(req, res, (err) => (err ? reject(err) : resolve())),
  );
}

// ── BAR SUGGESTIONS ───────────────────────────────────────────────────────

// GET /bars — public
router.get('/bars', async (_req: Request, res: Response) => {
  try {
    const data = await barSvc.listBarSuggestions();
    res.status(200).json({ data });
  } catch {
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /bars — optionalAuth + conditional rate limit
router.post('/bars', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limiter = req.user ? writeLimiter : anonymousSuggestionLimiter;
    await runMiddleware(limiter, req, res);

    const { name, address, instagram, isClosed, hasSoundSystem } = req.body as {
      name?: string;
      address?: string | null;
      instagram?: string | null;
      isClosed?: boolean;
      hasSoundSystem?: boolean;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name_required' });
      return;
    }

    const uid = req.user?.uid ?? null;
    const email = req.user?.email ?? null;

    const data = await barSvc.createBarSuggestion(uid, email, {
      name,
      address,
      instagram,
      isClosed,
      hasSoundSystem,
    });

    res.status(201).json({ data });
  } catch {
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /bars/:id — public
router.get('/bars/:id', async (req: Request, res: Response) => {
  try {
    const data = await barSvc.getBarSuggestion(req.params.id!);
    if (!data) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(200).json({ data });
  } catch {
    res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /bars/:id/status — admin only
router.patch(
  '/bars/:id/status',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.body as { status?: unknown };
      if (!status || !VALID_STATUSES.includes(status as SuggestionStatus)) {
        res.status(400).json({ error: 'invalid_status' });
        return;
      }
      await barSvc.updateBarSuggestionStatus(req.params.id!, status as SuggestionStatus);
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'not_found') {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// DELETE /bars/:id — admin only
router.delete(
  '/bars/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      await barSvc.deleteBarSuggestion(req.params.id!);
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'not_found') {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// ── BAR FEEDBACK ──────────────────────────────────────────────────────────

// GET /bars/:id/feedback — optionalAuth
router.get('/bars/:id/feedback', optionalAuth, async (req: Request, res: Response) => {
  try {
    const barId = req.params.id!;
    const counts = await feedbackSvc.getFeedbackCount(barId);
    let userVote: 'liked' | 'disliked' | undefined;
    if (req.user) {
      const feedback = await feedbackSvc.getUserFeedback(barId, req.user.uid);
      userVote = feedback?.vote ?? undefined;
    }
    res.status(200).json({ data: { ...counts, userVote } });
  } catch {
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /bars/:id/feedback — requireAuth + writeLimiter
router.post(
  '/bars/:id/feedback',
  requireAuth,
  writeLimiter,
  async (req: Request, res: Response) => {
    try {
      const { vote } = req.body as { vote?: unknown };
      if (vote !== 'liked' && vote !== 'disliked') {
        res.status(400).json({ error: 'invalid_vote' });
        return;
      }
      await feedbackSvc.upsertFeedback(req.params.id!, req.user!.uid, vote);
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// DELETE /bars/:id/feedback — requireAuth
router.delete('/bars/:id/feedback', requireAuth, async (req: Request, res: Response) => {
  try {
    await feedbackSvc.deleteFeedback(req.params.id!, req.user!.uid);
    res.status(204).send();
  } catch (err) {
    if (err instanceof Error && err.message === 'not_found') {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── BAR COMMENTS ──────────────────────────────────────────────────────────

// GET /bars/:id/comments — public
router.get('/bars/:id/comments', async (req: Request, res: Response) => {
  try {
    const data = await commentSvc.getCommentsBySuggestionId(req.params.id!);
    res.status(200).json({ data });
  } catch {
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /bars/:id/comments — requireAuth + writeLimiter
router.post(
  '/bars/:id/comments',
  requireAuth,
  writeLimiter,
  async (req: Request, res: Response) => {
    try {
      const { content } = req.body as { content?: unknown };
      if (!content || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'content_required' });
        return;
      }
      const data = await commentSvc.createSuggestionComment(req.user!.uid, {
        suggestionId: req.params.id!,
        suggestionType: 'bar',
        content: content.trim(),
      });
      res.status(201).json({ data });
    } catch {
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// DELETE /bars/:id/comments/:cId — requireAuth
router.delete(
  '/bars/:id/comments/:cId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const deleted = await commentSvc.deleteSuggestionComment(
        req.params.cId!,
        req.user!.uid,
        req.user!.role ?? 'user',
      ) as unknown as boolean;
      if (!deleted) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// ── ALBUM SUGGESTIONS ─────────────────────────────────────────────────────

// GET /albums — admin only
router.get(
  '/albums',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const statusParam = req.query['status'] as string | undefined;
      let status: SuggestionStatus | undefined;
      if (statusParam !== undefined) {
        if (!VALID_STATUSES.includes(statusParam as SuggestionStatus)) {
          res.status(400).json({ error: 'invalid_status' });
          return;
        }
        status = statusParam as SuggestionStatus;
      }
      const data = await albumSvc.listAlbumSuggestions(status);
      res.status(200).json({ data });
    } catch {
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// POST /albums — public (optionalAuth + conditional rate limit)
router.post('/albums', optionalAuth, async (req: Request, res: Response) => {
  try {
    const limiter = req.user ? writeLimiter : anonymousSuggestionLimiter;
    await runMiddleware(limiter, req, res);

    const { mbid, albumTitle, artistName, spotifyUrl, youtubeUrl, notes } = req.body as {
      mbid?: unknown;
      albumTitle?: unknown;
      artistName?: unknown;
      spotifyUrl?: unknown;
      youtubeUrl?: unknown;
      notes?: unknown;
    };
    const uid = req.user?.uid ?? null;
    const email = req.user?.email ?? null;
    const data = await albumSvc.createAlbumSuggestion(uid, email, {
      mbid: typeof mbid === 'string' ? mbid : null,
      albumTitle: typeof albumTitle === 'string' ? albumTitle : null,
      artistName: typeof artistName === 'string' ? artistName : null,
      spotifyUrl: typeof spotifyUrl === 'string' ? spotifyUrl : null,
      youtubeUrl: typeof youtubeUrl === 'string' ? youtubeUrl : null,
      notes: typeof notes === 'string' ? notes : null,
    });
    // Admin gets full record (id, status, suggestionCount, timestamps).
    // Non-admin gets a public subset — content fields only, no curation signals.
    if (req.user?.role === 'admin') {
      res.status(201).json({ data });
    } else {
      res.status(201).json({
        data: {
          mbid: data.mbid,
          albumTitle: data.albumTitle,
          artistName: data.artistName,
          coverUrl: data.coverUrl,
          spotifyUrl: data.spotifyUrl,
          youtubeUrl: data.youtubeUrl,
          notes: data.notes,
          instagramLink: data.instagramLink,
          suggestedByUid: data.suggestedByUid,
          suggestedByEmail: data.suggestedByEmail,
        },
      });
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'payload_required') {
        res.status(400).json({ error: 'payload_required' });
        return;
      }
      if (err.message === 'invalid_spotify_url') {
        res.status(400).json({ error: 'invalid_spotify_url' });
        return;
      }
      if (err.message === 'invalid_youtube_url') {
        res.status(400).json({ error: 'invalid_youtube_url' });
        return;
      }
    }
    res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /albums/:id/status — admin only
router.patch(
  '/albums/:id/status',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { status } = req.body as { status?: unknown };
      if (!status || !VALID_STATUSES.includes(status as SuggestionStatus)) {
        res.status(400).json({ error: 'invalid_status' });
        return;
      }
      await albumSvc.updateAlbumSuggestionStatus(req.params.id!, status as SuggestionStatus);
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'not_found') {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// DELETE /albums/:id — admin only
router.delete(
  '/albums/:id',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      await albumSvc.deleteAlbumSuggestion(req.params.id!);
      res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === 'not_found') {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// ── ALBUM COMMENTS ────────────────────────────────────────────────────────

// GET /albums/:id/comments — admin only
router.get(
  '/albums/:id/comments',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const data = await commentSvc.getCommentsBySuggestionId(req.params.id!);
      res.status(200).json({ data });
    } catch {
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// POST /albums/:id/comments — admin only + writeLimiter
router.post(
  '/albums/:id/comments',
  requireAuth,
  requireRole('admin'),
  writeLimiter,
  async (req: Request, res: Response) => {
    try {
      const { content } = req.body as { content?: unknown };
      if (!content || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'content_required' });
        return;
      }
      const data = await commentSvc.createSuggestionComment(req.user!.uid, {
        suggestionId: req.params.id!,
        suggestionType: 'album',
        content: content.trim(),
      });
      res.status(201).json({ data });
    } catch {
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

// DELETE /albums/:id/comments/:cId — admin only
router.delete(
  '/albums/:id/comments/:cId',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const deleted = await commentSvc.deleteSuggestionComment(
        req.params.cId!,
        req.user!.uid,
        req.user!.role ?? 'user',
      ) as unknown as boolean;
      if (!deleted) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'internal_error' });
    }
  },
);

export const suggestionsRouter = router;
