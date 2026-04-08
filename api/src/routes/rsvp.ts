// RSVP routes — nested under /events/:eventId/rsvp.
// Public reads, auth writes, admin management.

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import {
  getRsvpSummary,
  getUserRsvp,
  submitRsvp,
  cancelRsvp,
  updatePlusOne,
  getAdminList,
  approveOrReject,
  exportCsv,
} from '../services/rsvpService';
import { buildRsvpEmail } from '../services/emailTemplateService';
import { sendEmail, wrapTransactionalTemplate } from '../services/emailService';
import { adminDb } from '../config/firebase';

/** Fire-and-forget: send RSVP email if template is enabled. */
async function sendRsvpEmail(
  key: Parameters<typeof buildRsvpEmail>[0],
  userId: string,
  variables: Record<string, string>,
): Promise<void> {
  try {
    const userSnap = await adminDb.collection('users').doc(userId).get();
    const email = (userSnap.data() as { email?: string } | undefined)?.email;
    if (!email) return;
    const result = await buildRsvpEmail(key, { ...variables, nome: (userSnap.data() as { displayName?: string })?.displayName ?? 'você' });
    if (!result) return;
    const html = wrapTransactionalTemplate(`<p>${result.bodyText.replace(/\n/g, '<br>')}</p>`);
    await sendEmail(email, result.subject, html);
  } catch (err) {
    console.error(`[rsvp-email] Failed to send ${key} to ${userId}:`, err);
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
    const entry = await getUserRsvp(req.params.eventId!, req.user!.uid);
    res.status(200).json({ entry });
  } catch {
    res.status(500).json({ error: 'rsvp_user_failed' });
  }
});

// POST /events/:eventId/rsvp — submit RSVP
rsvpRouter.post(
  '/',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { plusOne?: boolean; plusOneName?: string } | undefined;
      const eventId = req.params.eventId!;
      const userId = req.user!.uid;
      const result = await submitRsvp(eventId, userId, {
        plusOne: body?.plusOne,
        plusOneName: body?.plusOneName,
      });
      res.status(201).json(result);

      // Send email (fire-and-forget, after response)
      const eventSnap = await adminDb.collection('events').doc(eventId).get();
      const ev = eventSnap.data() as { title?: string; date?: string; startTime?: string } | undefined;
      const vars = { evento: ev?.title ?? '', data: ev?.date ?? '', horario: ev?.startTime ?? '' };
      const emailKey = result.entry.status === 'confirmed' ? 'confirmation' as const
        : result.entry.status === 'waitlisted' ? 'waitlist' as const
        : null;
      if (emailKey) void sendRsvpEmail(emailKey, userId, vars);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'submit_failed';
      const status = ['rsvp_disabled', 'rsvp_closed', 'already_rsvped', 'event_full'].includes(msg) ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  },
);

// DELETE /events/:eventId/rsvp — cancel RSVP
rsvpRouter.delete(
  '/',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const eventId = req.params.eventId!;
      const result = await cancelRsvp(eventId, req.user!.uid);
      res.status(200).json(result);

      // Send promotion email if someone was auto-promoted
      if (result.promotedUserId) {
        const eventSnap = await adminDb.collection('events').doc(eventId).get();
        const ev = eventSnap.data() as { title?: string; date?: string; startTime?: string } | undefined;
        void sendRsvpEmail('promotion', result.promotedUserId, {
          evento: ev?.title ?? '', data: ev?.date ?? '', horario: ev?.startTime ?? '',
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
      const entry = await updatePlusOne(
        req.params.eventId!,
        req.user!.uid,
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

// GET /events/:eventId/rsvp/admin/export — CSV download (MUST be before :userId)
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

// GET /events/:eventId/rsvp/admin — full list with user details
rsvpRouter.get(
  '/admin',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const entries = await getAdminList(req.params.eventId!);
      res.status(200).json({ entries });
    } catch {
      res.status(500).json({ error: 'admin_list_failed' });
    }
  },
);

// PUT /events/:eventId/rsvp/admin/:userId — approve/reject
rsvpRouter.put(
  '/admin/:userId',
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
      const targetUserId = req.params.userId!;
      const entry = await approveOrReject(eventId, targetUserId, newStatus);
      res.status(200).json({ entry });

      // Send email
      const eventSnap = await adminDb.collection('events').doc(eventId).get();
      const ev = eventSnap.data() as { title?: string; date?: string; startTime?: string } | undefined;
      const vars = { evento: ev?.title ?? '', data: ev?.date ?? '', horario: ev?.startTime ?? '' };
      const emailKey = newStatus === 'confirmed' ? 'confirmation' as const : 'rejected' as const;
      void sendRsvpEmail(emailKey, targetUserId, vars);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'approve_failed';
      res.status(500).json({ error: msg });
    }
  },
);

