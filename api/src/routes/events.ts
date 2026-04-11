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
  updateEvent,
} from '../services/eventService';
import { getRsvpSummary } from '../services/rsvpService';
import { buildRsvpEmail } from '../services/emailTemplateService';
import { sendBulk, wrapTransactionalTemplate } from '../services/emailService';
import type { Event, EventCreatePayload } from '../types';
import { rsvpRouter } from './rsvp';

export const eventsRouter: Router = Router();

// Nested RSVP routes: /events/:eventId/rsvp/*
eventsRouter.use('/:eventId/rsvp', rsvpRouter);

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
    location: typeof b.location === 'string' ? b.location : null,
    venueRevealDaysBefore:
      typeof b.venueRevealDaysBefore === 'number' && b.venueRevealDaysBefore >= 0
        ? Math.floor(b.venueRevealDaysBefore)
        : undefined,
    spotifyPlaylistUrl:
      typeof b.spotifyPlaylistUrl === 'string' ? b.spotifyPlaylistUrl : null,
    chatEnabled: typeof b.chatEnabled === 'boolean' ? b.chatEnabled : undefined,
    chatOpensAt:
      typeof b.chatOpensAt === 'number'
        ? b.chatOpensAt
        : b.chatOpensAt === null
        ? null
        : undefined,
    chatClosesAt:
      typeof b.chatClosesAt === 'number'
        ? b.chatClosesAt
        : b.chatClosesAt === null
        ? null
        : undefined,
  };
}

/** Whitelist for PUT /events/:id patches — keeps arbitrary fields out of Firestore. */
function parseUpdatePatch(body: unknown): Partial<Event> {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  const patch: Partial<Event> = {};
  if (typeof b.title === 'string') patch.title = b.title;
  if (typeof b.date === 'string') patch.date = b.date;
  if (typeof b.startTime === 'string') patch.startTime = b.startTime;
  if (typeof b.endTime === 'string') patch.endTime = b.endTime;
  if (typeof b.location === 'string' || b.location === null) patch.location = b.location as string | null;
  if (typeof b.venueRevealDaysBefore === 'number' && b.venueRevealDaysBefore >= 0) {
    patch.venueRevealDaysBefore = Math.floor(b.venueRevealDaysBefore);
  }
  if (typeof b.spotifyPlaylistUrl === 'string' || b.spotifyPlaylistUrl === null) {
    patch.spotifyPlaylistUrl = b.spotifyPlaylistUrl as string | null;
  }
  if (b.extras && typeof b.extras === 'object') patch.extras = b.extras as Event['extras'];
  if (b.rsvp && typeof b.rsvp === 'object') patch.rsvp = b.rsvp as Event['rsvp'];
  if (typeof b.chatEnabled === 'boolean') patch.chatEnabled = b.chatEnabled;
  if (typeof b.chatOpensAt === 'number' || b.chatOpensAt === null) {
    patch.chatOpensAt = b.chatOpensAt as number | null;
  }
  if (typeof b.chatClosesAt === 'number' || b.chatClosesAt === null) {
    patch.chatClosesAt = b.chatClosesAt as number | null;
  }
  return patch;
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
      invalidateCache();
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
      const patch = parseUpdatePatch(req.body);
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
          const html = wrapTransactionalTemplate(
            `<p>${built.bodyText.replace(/\n/g, '<br>')}</p>`,
          );
          await sendBulk(
            recipients.map((r) => r.email),
            built.subject,
            html,
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
      const html = wrapTransactionalTemplate(
        `<p>${built.bodyText.replace(/\n/g, '<br>')}</p>`,
      );
      const sent = await sendBulk(
        recipients.map((r) => r.email),
        built.subject,
        html,
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
