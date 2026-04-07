import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import { adminDb } from '../config/firebase';
import type { LinkTreeItem } from '../types';

const COLLECTION = 'linktree';

export const linktreeRouter: Router = Router();

/** GET /linktree — public, lists active links ordered by sortOrder */
linktreeRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection(COLLECTION)
      .where('active', '==', true)
      .orderBy('sortOrder', 'asc')
      .get();
    const links = snap.docs.map((d) => d.data() as LinkTreeItem);
    res.status(200).json({ links });
  } catch {
    res.status(500).json({ error: 'list_links_failed' });
  }
});

/** GET /linktree/all — admin, lists all links (including inactive) */
linktreeRouter.get(
  '/all',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb.collection(COLLECTION)
        .orderBy('sortOrder', 'asc')
        .get();
      const links = snap.docs.map((d) => d.data() as LinkTreeItem);
      res.status(200).json({ links });
    } catch {
      res.status(500).json({ error: 'list_links_failed' });
    }
  },
);

/** POST /linktree — admin, create link */
linktreeRouter.post(
  '/',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { title, url, emoji } = req.body as {
      title?: string;
      url?: string;
      emoji?: string;
    };
    if (!title || typeof title !== 'string' || !url || typeof url !== 'string') {
      res.status(400).json({ error: 'title and url are required' });
      return;
    }
    if (!url.startsWith('https://')) {
      res.status(400).json({ error: 'url must start with https://' });
      return;
    }
    try {
      const countSnap = await adminDb.collection(COLLECTION).count().get();
      const sortOrder = countSnap.data().count;
      const now = Date.now();
      const ref = adminDb.collection(COLLECTION).doc();
      const link: LinkTreeItem = {
        id: ref.id,
        title: title.trim(),
        url: url.trim(),
        emoji: (emoji ?? '🔗').trim(),
        sortOrder,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(link);
      res.status(201).json({ link });
    } catch {
      res.status(500).json({ error: 'create_link_failed' });
    }
  },
);

/** PUT /linktree/reorder — admin, reorder links (must be before /:id) */
linktreeRouter.put(
  '/reorder',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids)) {
      res.status(400).json({ error: 'ids array required' });
      return;
    }
    try {
      // Verify all IDs belong to linktree collection
      const snap = await adminDb.collection(COLLECTION).get();
      const validIds = new Set(snap.docs.map((d) => d.id));
      if (ids.some((id) => !validIds.has(id))) {
        res.status(400).json({ error: 'invalid link id in array' });
        return;
      }
      const batch = adminDb.batch();
      const now = Date.now();
      ids.forEach((id, i) => {
        batch.update(adminDb.collection(COLLECTION).doc(id), { sortOrder: i, updatedAt: now });
      });
      await batch.commit();
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'reorder_failed' });
    }
  },
);

/** PUT /linktree/:id — admin, update link */
linktreeRouter.put(
  '/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { title, url, emoji, active } = req.body as {
      title?: string;
      url?: string;
      emoji?: string;
      active?: boolean;
    };
    try {
      const ref = adminDb.collection(COLLECTION).doc(req.params.id!);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'link_not_found' });
        return;
      }
      const update: Record<string, unknown> = { updatedAt: Date.now() };
      if (typeof title === 'string') update.title = title.trim();
      if (typeof url === 'string') {
        if (!url.startsWith('https://')) {
          res.status(400).json({ error: 'url must start with https://' });
          return;
        }
        update.url = url.trim();
      }
      if (typeof emoji === 'string') update.emoji = emoji.trim();
      if (typeof active === 'boolean') update.active = active;
      await ref.update(update);
      const updated = { ...(snap.data() as LinkTreeItem), ...update };
      res.status(200).json({ link: updated });
    } catch {
      res.status(500).json({ error: 'update_link_failed' });
    }
  },
);

/** DELETE /linktree/:id — admin, delete link */
linktreeRouter.delete(
  '/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const ref = adminDb.collection(COLLECTION).doc(req.params.id!);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'link_not_found' });
        return;
      }
      await ref.delete();
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'delete_link_failed' });
    }
  },
);
