// Events routes — P3-B.
// Reads: public. Writes: admin-only, writeLimiter.

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import {
  createEvent,
  deleteEvent,
  getCurrentEvent,
  getEventById,
  listEvents,
  updateEvent,
} from '../services/eventService';
import type { EventCreatePayload } from '../types';

export const eventsRouter: Router = Router();

eventsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const events = await listEvents();
    res.status(200).json({ events });
  } catch {
    res.status(500).json({ error: 'list_failed' });
  }
});

eventsRouter.get('/current', async (_req: Request, res: Response) => {
  try {
    const event = await getCurrentEvent();
    if (!event) {
      res.status(404).json({ error: 'no_current_event' });
      return;
    }
    res.status(200).json({ event });
  } catch {
    res.status(500).json({ error: 'current_failed' });
  }
});

eventsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await getEventById(req.params.id!);
    if (!event) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(200).json({ event });
  } catch {
    res.status(500).json({ error: 'get_failed' });
  }
});

function parsePayload(body: unknown): EventCreatePayload | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.mbAlbumId !== 'string' ||
    typeof b.title !== 'string' ||
    typeof b.date !== 'string' ||
    typeof b.startTime !== 'string' ||
    typeof b.endTime !== 'string' ||
    typeof b.extras !== 'object' ||
    b.extras === null
  ) {
    return null;
  }
  return {
    mbAlbumId: b.mbAlbumId,
    title: b.title,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    extras: b.extras as EventCreatePayload['extras'],
    spotifyPlaylistUrl:
      typeof b.spotifyPlaylistUrl === 'string' ? b.spotifyPlaylistUrl : null,
  };
}

eventsRouter.post(
  '/',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const payload = parsePayload(req.body);
    if (!payload) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }
    try {
      const event = await createEvent(payload, req.user!.uid);
      res.status(201).json({ event });
    } catch {
      res.status(500).json({ error: 'create_failed' });
    }
  },
);

eventsRouter.put(
  '/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const updated = await updateEvent(req.params.id!, req.body ?? {});
      if (!updated) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(200).json({ event: updated });
    } catch {
      res.status(500).json({ error: 'update_failed' });
    }
  },
);

const SPOTIFY_PLAYLIST_RE =
  /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(\?.*)?$/;

eventsRouter.put(
  '/:id/spotify',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const body = req.body as { spotifyPlaylistUrl?: unknown } | undefined;
    const url = body?.spotifyPlaylistUrl;
    if (typeof url !== 'string' || !SPOTIFY_PLAYLIST_RE.test(url)) {
      res.status(400).json({ error: 'invalid_spotify_url' });
      return;
    }
    try {
      const updated = await updateEvent(req.params.id!, {
        spotifyPlaylistUrl: url,
      });
      if (!updated) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(200).json({ event: updated });
    } catch {
      res.status(500).json({ error: 'spotify_update_failed' });
    }
  },
);

eventsRouter.delete(
  '/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const ok = await deleteEvent(req.params.id!);
      if (!ok) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'delete_failed' });
    }
  },
);
