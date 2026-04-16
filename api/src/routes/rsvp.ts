// RSVP routes — nested under /events/:eventId/rsvp.
// Public reads, auth writes, admin management.
//
// entryKey format (new in guest-RSVP sprint): `firebase:${uid}` or `guest:${hash}`.
// In URLs the `:` must be percent-encoded (`%3A`). Express decodes it back for
// req.params.entryKey, so `/admin/firebase%3Aabc123` arrives as
// `entryKey = 'firebase:abc123'`. We chose `:` (not `_`) to stay consistent with
// the Firestore doc keys and avoid a second mental model.

import { Router, type Request, type Response } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { guestRsvpLimiter, writeLimiter } from '../middleware/rateLimit';
import {
  getRsvpSummary,
  getUserRsvp,
  submitRsvp,
  cancelRsvp,
  updatePlusOne,
  getAdminList,
  approveOrReject,
  adminCancelRsvp,
  moveToWaitlist,
  exportCsv,
  exportPdf,
  buildEntryKey,
  bulkImportRsvp,
  type SubmitRsvpInput,
} from '../services/rsvpService';
import { buildRsvpEmail } from '../services/emailTemplateService';
import { sendEmail, wrapTransactionalTemplate } from '../services/emailService';
import { adminDb } from '../config/firebase';
import type { RsvpDoc, RsvpEntry } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Read the RsvpEntry for a given entryKey, falling back to users/{uid} when firebase. */
async function resolveEmailForEntry(
  eventId: string,
  entryKey: string,
): Promise<{ email: string | null; displayName: string }> {
  const snap = await adminDb.collection('rsvps').doc(eventId).get();
  let entry: RsvpEntry | undefined;
  if (snap.exists) {
    const doc = snap.data() as RsvpDoc;
    entry = doc.entries[entryKey];
    if (!entry && entryKey.startsWith('firebase:')) {
      entry = doc.entries[entryKey.slice('firebase:'.length)];
    }
  }
  if (entry?.email) {
    return { email: entry.email, displayName: entry.displayName || 'você' };
  }
  // Firebase fallback: read users/{uid}
  if (entryKey.startsWith('firebase:')) {
    const uid = entryKey.slice('firebase:'.length);
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const user = userSnap.exists
      ? (userSnap.data() as { email?: string | null; displayName?: string })
      : null;
    return {
      email: user?.email ?? null,
      displayName: entry?.displayName || user?.displayName || 'você',
    };
  }
  return { email: null, displayName: entry?.displayName || 'você' };
}

/** Fire-and-forget: send RSVP email if template is enabled. */
async function sendRsvpEmail(
  key: Parameters<typeof buildRsvpEmail>[0],
  eventId: string,
  entryKey: string,
  variables: Record<string, string>,
): Promise<void> {
  try {
    const { email, displayName } = await resolveEmailForEntry(eventId, entryKey);
    if (!email) return;
    const result = await buildRsvpEmail(key, { ...variables, nome: displayName });
    if (!result) return;
    const html = wrapTransactionalTemplate(`<p>${result.bodyText.replace(/\n/g, '<br>')}</p>`);
    await sendEmail(email, result.subject, html);
  } catch (err) {
    console.error(`[rsvp-email] Failed to send ${key} to ${entryKey}:`, err);
  }
}

export const rsvpRouter: Router = Router({ mergeParams: true });

// GET /events/:eventId/rsvp — public summary (counts + avatars)
rsvpRouter.get('/', async (req: Request, res: Response) => {
  try {
    const summary = await getRsvpSummary(req.params.eventId!);
    res.status(200).json(summary);
  } catch {
    res.status(500).json({ error: 'rsvp_summary_failed' });
  }
});

// GET /events/:eventId/rsvp/user — current user's RSVP status
rsvpRouter.get('/user', requireAuth, async (req: Request, res: Response) => {
  try {
    const entryKey = buildEntryKey({ type: 'firebase', uid: req.user!.uid });
    const entry = await getUserRsvp(req.params.eventId!, entryKey);
    res.status(200).json({ entry });
  } catch {
    res.status(500).json({ error: 'rsvp_user_failed' });
  }
});

// POST /events/:eventId/rsvp — submit RSVP
// Accepts both authenticated (firebase) and anonymous (guest) submissions.
rsvpRouter.post(
  '/',
  writeLimiter,
  guestRsvpLimiter,
  optionalAuth,
  async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        email?: string;
        displayName?: string;
        instagram?: string;
        plusOne?: boolean;
        plusOneName?: string;
      };
      const eventId = req.params.eventId!;

      let input: SubmitRsvpInput;
      if (req.user) {
        // Authenticated — pull email/displayName from the users doc.
        const userSnap = await adminDb.collection('users').doc(req.user.uid).get();
        const user = userSnap.exists
          ? (userSnap.data() as { email?: string; displayName?: string })
          : null;
        const email = user?.email ?? req.user.email ?? '';
        const displayName = user?.displayName ?? req.user.name ?? 'anônimo';
        input = {
          type: 'firebase',
          uid: req.user.uid,
          email,
          displayName,
          instagram: body.instagram?.trim() || undefined,
          plusOne: body.plusOne,
          plusOneName: body.plusOneName,
        };
      } else {
        const email = (body.email ?? '').trim();
        const displayName = (body.displayName ?? '').trim();
        if (!email || !EMAIL_RE.test(email)) {
          res.status(400).json({ error: 'invalid_email' });
          return;
        }
        if (!displayName || displayName.length > 80) {
          res.status(400).json({ error: 'invalid_display_name' });
          return;
        }
        input = {
          type: 'guest',
          email,
          displayName,
          instagram: body.instagram?.trim() || undefined,
          plusOne: body.plusOne,
          plusOneName: body.plusOneName,
        };
      }

      const result = await submitRsvp(eventId, input);
      res.status(201).json({ entry: result.entry, entryKey: result.entryKey });

      // Send email (fire-and-forget, after response)
      const eventSnap = await adminDb.collection('events').doc(eventId).get();
      const ev = eventSnap.data() as { title?: string; date?: string; startTime?: string; location?: string } | undefined;
      const vars = { evento: ev?.title ?? '', data: ev?.date ?? '', horario: ev?.startTime ?? '', local: ev?.location ?? '' };
      const emailKey = result.entry.status === 'confirmed' ? 'confirmation' as const
        : result.entry.status === 'waitlisted' ? 'waitlist' as const
        : null;
      if (emailKey) void sendRsvpEmail(emailKey, eventId, result.entryKey, vars);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'submit_failed';
      const status = [
        'rsvp_disabled',
        'rsvp_closed',
        'already_rsvped',
        'email_already_rsvped',
        'event_full',
        'event_not_found',
      ].includes(msg)
        ? 400
        : 500;
      res.status(status).json({ error: msg });
    }
  },
);

// DELETE /events/:eventId/rsvp — cancel RSVP (authenticated only)
rsvpRouter.delete(
  '/',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const eventId = req.params.eventId!;
      const entryKey = buildEntryKey({ type: 'firebase', uid: req.user!.uid });
      const result = await cancelRsvp(eventId, entryKey);
      res.status(200).json({
        promotedUserId: result.promotedEntryKey,
        promotedEntryKey: result.promotedEntryKey,
      });

      // Send promotion email if someone was auto-promoted
      if (result.promotedEntryKey) {
        const eventSnap = await adminDb.collection('events').doc(eventId).get();
        const ev = eventSnap.data() as { title?: string; date?: string; startTime?: string; location?: string } | undefined;
        void sendRsvpEmail('promotion', eventId, result.promotedEntryKey, {
          evento: ev?.title ?? '', data: ev?.date ?? '', horario: ev?.startTime ?? '', local: ev?.location ?? '',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'cancel_failed';
      res.status(msg === 'not_rsvped' ? 400 : 500).json({ error: msg });
    }
  },
);

// PUT /events/:eventId/rsvp/plus-one — update +1
rsvpRouter.put(
  '/plus-one',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { plusOne?: boolean; plusOneName?: string } | undefined;
      const entryKey = buildEntryKey({ type: 'firebase', uid: req.user!.uid });
      const entry = await updatePlusOne(
        req.params.eventId!,
        entryKey,
        !!body?.plusOne,
        body?.plusOneName ?? null,
      );
      res.status(200).json({ entry });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'update_failed';
      res.status(msg === 'event_full' ? 400 : 500).json({ error: msg });
    }
  },
);

// ── Admin endpoints ─────────────────────────────────────────────────

// GET /events/:eventId/rsvp/admin/export — CSV download (MUST be before :entryKey)
rsvpRouter.get(
  '/admin/export',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const entries = await getAdminList(req.params.eventId!);
      const csv = exportCsv(entries);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rsvp-${req.params.eventId}.csv"`);
      res.status(200).send(csv);
    } catch {
      res.status(500).json({ error: 'export_failed' });
    }
  },
);

// GET /events/:eventId/rsvp/admin/export-pdf — PDF download with confirmed RSVPs (MUST be before :entryKey)
rsvpRouter.get(
  '/admin/export-pdf',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const eventId = req.params.eventId!;
      const entries = await getAdminList(eventId);
      const eventSnap = await adminDb.collection('events').doc(eventId).get();
      const event = eventSnap.data() as { title?: string; date?: string } | undefined;
      const title = event?.title ?? 'Evento';
      const date = event?.date ?? new Date().toISOString().split('T')[0];

      const pdfBuffer = await exportPdf(entries, title, date);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="confirmados-${eventId}.pdf"`);
      res.status(200).send(pdfBuffer);
    } catch (err) {
      console.error('[rsvp export-pdf]', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'export_pdf_failed', details: err instanceof Error ? err.message : String(err) });
    }
  },
);

// GET /events/:eventId/rsvp/admin — full list with user details
rsvpRouter.get(
  '/admin',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const eventId = req.params.eventId!;
      const [entries, eventSnap] = await Promise.all([
        getAdminList(eventId),
        adminDb.collection('events').doc(eventId).get(),
      ]);
      const event = eventSnap.exists
        ? (eventSnap.data() as { rsvp?: { capacity?: number | null } })
        : null;
      const capacity = event?.rsvp?.capacity ?? null;
      res.status(200).json({ entries, capacity });
    } catch {
      res.status(500).json({ error: 'admin_list_failed' });
    }
  },
);

// PUT /events/:eventId/rsvp/admin/:entryKey/move-to-waitlist — move confirmed → waitlist
rsvpRouter.put(
  '/admin/:entryKey/move-to-waitlist',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const eventId = req.params.eventId!;
      const targetEntryKey = req.params.entryKey!;
      const result = await moveToWaitlist(eventId, targetEntryKey);
      res.status(200).json({ promotedEntryKey: result.promotedEntryKey });

      if (result.promotedEntryKey) {
        const eventSnap = await adminDb.collection('events').doc(eventId).get();
        const ev = eventSnap.data() as { title?: string; date?: string; startTime?: string; location?: string } | undefined;
        void sendRsvpEmail('promotion', eventId, result.promotedEntryKey, {
          evento: ev?.title ?? '', data: ev?.date ?? '', horario: ev?.startTime ?? '', local: ev?.location ?? '',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'move_failed';
      const status = msg === 'invalid_transition' || msg === 'entry_not_found' ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  },
);

// DELETE /events/:eventId/rsvp/admin/:entryKey — admin cancels any entry
rsvpRouter.delete(
  '/admin/:entryKey',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const eventId = req.params.eventId!;
      const targetEntryKey = req.params.entryKey!;
      const result = await adminCancelRsvp(eventId, targetEntryKey);
      res.status(200).json({ promotedEntryKey: result.promotedEntryKey });

      if (result.promotedEntryKey) {
        const eventSnap = await adminDb.collection('events').doc(eventId).get();
        const ev = eventSnap.data() as { title?: string; date?: string; startTime?: string; location?: string } | undefined;
        void sendRsvpEmail('promotion', eventId, result.promotedEntryKey, {
          evento: ev?.title ?? '', data: ev?.date ?? '', horario: ev?.startTime ?? '', local: ev?.location ?? '',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'cancel_failed';
      const status = msg === 'not_rsvped' || msg === 'no_rsvp' ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  },
);

// PUT /events/:eventId/rsvp/admin/:entryKey — approve/reject
// entryKey must be URL-encoded (`:` as `%3A`).
rsvpRouter.put(
  '/admin/:entryKey',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { status?: string } | undefined;
      const newStatus = body?.status;
      if (newStatus !== 'confirmed' && newStatus !== 'rejected') {
        res.status(400).json({ error: 'invalid_status' });
        return;
      }
      const eventId = req.params.eventId!;
      const targetEntryKey = req.params.entryKey!;
      const entry = await approveOrReject(eventId, targetEntryKey, newStatus);
      res.status(200).json({ entry });

      // Send email
      const eventSnap = await adminDb.collection('events').doc(eventId).get();
      const ev = eventSnap.data() as { title?: string; date?: string; startTime?: string; location?: string } | undefined;
      const vars = { evento: ev?.title ?? '', data: ev?.date ?? '', horario: ev?.startTime ?? '', local: ev?.location ?? '' };
      const emailKey = newStatus === 'confirmed' ? 'confirmation' as const : 'rejected' as const;
      void sendRsvpEmail(emailKey, eventId, targetEntryKey, vars);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'approve_failed';
      res.status(500).json({ error: msg });
    }
  },
);

// POST /events/:eventId/rsvp/admin/import — bulk import RSVPs from CSV/Excel
rsvpRouter.post(
  '/admin/import',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        entries?: Array<{ displayName?: string; email?: string; plusOne?: boolean; plusOneName?: string }>;
      };
      const entries = body.entries ?? [];
      if (!Array.isArray(entries)) {
        res.status(400).json({ error: 'invalid_payload' });
        return;
      }

      // Validate and normalize entries
      const normalized = entries
        .filter((e) => e.email && e.displayName)
        .map((e) => ({
          displayName: (e.displayName ?? '').toString().slice(0, 80),
          email: (e.email ?? '').toString().toLowerCase().trim(),
          plusOne: !!e.plusOne,
          plusOneName: e.plusOneName ? (e.plusOneName ?? '').toString().slice(0, 80) : null,
        }));

      const result = await bulkImportRsvp(req.params.eventId!, normalized);
      res.status(200).json({ imported: result.imported, skipped: result.skipped });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'import_failed';
      res.status(500).json({ error: msg });
    }
  },
);
