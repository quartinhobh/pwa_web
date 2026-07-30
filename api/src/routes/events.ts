// Events routes — P3-B.
// Reads: public. Writes: admin-only, writeLimiter.

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import {
  cancelEvent,
  createEvent,
  deleteEvent,
  getCurrentEvent,
  getEventById,
  getRsvpEmailsByFilter,
  listEvents,
  refreshEventCredits,
  updateEvent,
} from '../services/eventService';
import { getRsvpSummary } from '../services/rsvpService';
import { buildRsvpEmail } from '../services/emailTemplateService';
import { renderTransactionalEmail, sendBulk } from '../services/emailService';
import { parseEventCreate, parseEventPatch } from '../services/eventDto';
import type { Event } from '../types';
import { rsvpRouter } from './rsvp';

export const eventsRouter: Router = Router();

// ── In-memory cache (TTL 60s, invalidated on writes) ─────────────
const CACHE_TTL = 10 * 60_000; // 10 min — invalidated instantly on admin writes
let listCache: { data: Event[]; at: number } | null = null;
let currentCache: { data: Event | null; at: number } | null = null;

function invalidateCache() {
  listCache = null;
  currentCache = null;
}

eventsRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (listCache && Date.now() - listCache.at < CACHE_TTL) {
      const status = req.query.status as string | undefined;
      const filtered = status ? listCache.data.filter((e) => e.status === status) : listCache.data;
      res.status(200).json({ events: filtered });
      return;
    }
    const events = await listEvents();
    listCache = { data: events, at: Date.now() };
    const status = req.query.status as string | undefined;
    const filtered = status ? events.filter((e) => e.status === status) : events;
    res.status(200).json({ events: filtered });
  } catch (err) {
    console.error('[GET /events]', err);
    res.status(500).json({ error: 'list_failed' });
  }
});

eventsRouter.get('/current', async (_req: Request, res: Response) => {
  try {
    let event: Event | null;
    if (currentCache && Date.now() - currentCache.at < CACHE_TTL) {
      event = currentCache.data;
    } else {
      event = await getCurrentEvent();
      currentCache = { data: event, at: Date.now() };
    }
    if (!event) {
      res.status(404).json({ error: 'no_current_event' });
      return;
    }
    // Inline the RSVP summary so the client doesn't need a follow-up roundtrip
    // before rendering the RSVP block. We fetch summary best-effort — if it
    // throws (e.g. transient Firestore hiccup), the client falls back to its
    // own /events/:id/rsvp request, so this never blocks event rendering.
    let rsvpSummary = null;
    if (event.rsvp?.enabled) {
      try {
        rsvpSummary = await getRsvpSummary(event.id);
      } catch (err) {
        console.error('[GET /events/current] rsvp_summary_inline_failed', err);
      }
    }
    res.status(200).json({ event, rsvpSummary });
  } catch (err) {
    console.error('[GET /events/current]', err);
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

eventsRouter.post(
  '/',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const payload = parseEventCreate(req.body);
    if (!payload) {
      res.status(400).json({ error: 'invalid_payload' });
      return;
    }
    try {
      const event = await createEvent(payload, req.user!.uid);
      invalidateCache();
      res.status(201).json({ event });
    } catch (err) {
      console.error('[POST /events]', err);
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
      const patch = parseEventPatch(req.body);
      if (!patch) {
        res.status(400).json({ error: 'invalid_payload' });
        return;
      }
      const updated = await updateEvent(req.params.id!, patch);
      if (!updated) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      invalidateCache();
      res.status(200).json({ event: updated });
    } catch {
      res.status(500).json({ error: 'update_failed' });
    }
  },
);

// POST /events/:id/cancel — admin cancels an event and emails its RSVPs.
eventsRouter.post(
  '/:id/cancel',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id!;
      const body = (req.body ?? {}) as { reason?: string };
      const reason = typeof body.reason === 'string' ? body.reason : undefined;
      const event = await cancelEvent(id, reason);
      if (!event) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      invalidateCache();
      res.status(200).json({ event });

      // Fire-and-forget broadcast to all non-cancelled/rejected entries.
      void (async () => {
        try {
          const recipients = await getRsvpEmailsByFilter(id, 'all');
          if (!recipients.length) return;
          // buildRsvpEmail short-circuits if template disabled / master pause on.
          // Per-recipient `{nome}` would require N sends; we compromise by using
          // a generic 'amigo' placeholder in the bulk version to stay in a single
          // Brevo call. Individualization can come later if needed.
          const built = await buildRsvpEmail('event_cancelled', {
            nome: 'amigo',
            evento: event.title,
            data: event.date,
            motivo: reason?.trim() || 'não informado',
          });
          if (!built) return;
          const rendered = renderTransactionalEmail(built.bodyText);
          await sendBulk(
            recipients.map((r) => r.email),
            built.subject,
            rendered.html,
          );
        } catch (err) {
          console.error('[events.cancel] broadcast failed', err);
        }
      })();
    } catch {
      res.status(500).json({ error: 'cancel_failed' });
    }
  },
);

// POST /events/:id/broadcast — admin-authored message to all/confirmed/waitlisted RSVPs.
eventsRouter.post(
  '/:id/broadcast',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const id = req.params.id!;
      const body = (req.body ?? {}) as {
        subject?: string;
        body?: string;
        filter?: 'confirmed' | 'waitlisted' | 'all';
      };
      const subject = (body.subject ?? '').trim();
      const bodyText = (body.body ?? '').trim();
      const filter = body.filter;
      if (!subject || subject.length > 200) {
        res.status(400).json({ error: 'invalid_subject' });
        return;
      }
      if (!bodyText || bodyText.length > 5000) {
        res.status(400).json({ error: 'invalid_body' });
        return;
      }
      if (filter !== 'confirmed' && filter !== 'waitlisted' && filter !== 'all') {
        res.status(400).json({ error: 'invalid_filter' });
        return;
      }
      const event = await getEventById(id);
      if (!event) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const recipients = await getRsvpEmailsByFilter(id, filter);
      if (!recipients.length) {
        res.status(200).json({ sentCount: 0 });
        return;
      }
      const built = await buildRsvpEmail('event_broadcast', {
        nome: 'amigo',
        evento: event.title,
        assunto: subject,
        corpo: bodyText,
      });
      if (!built) {
        res.status(200).json({ sentCount: 0 });
        return;
      }
      const rendered = renderTransactionalEmail(built.bodyText);
      const sent = await sendBulk(
        recipients.map((r) => r.email),
        built.subject,
        rendered.html,
      );
      res.status(200).json({ sentCount: sent });
    } catch (err) {
      console.error('[events.broadcast] failed', err);
      res.status(500).json({ error: 'broadcast_failed' });
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
      invalidateCache();
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
      invalidateCache();
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'delete_failed' });
    }
  },
);

// Admin: refresh credits from MusicBrainz
eventsRouter.post(
  '/:eventId/refresh-credits',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const { credits, debug } = await refreshEventCredits(req.params.eventId!);
      if (!credits) {
        res.status(404).json({ error: 'event_not_found_or_no_mbid' });
        return;
      }
      invalidateCache();
      res.status(200).json({ credits, debug });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'refresh_failed';
      res.status(500).json({ error: msg });
    }
  },
);

// Nested RSVP routes: /events/:eventId/rsvp/*
// MUST be after all specific routes (e.g. /current, /:id) so they don't get caught by :eventId
eventsRouter.use('/:eventId/rsvp', rsvpRouter);
