import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import { adminDb } from '../config/firebase';
import { createR2Client, getR2PublicUrl, R2_BUCKET } from '../config/r2';
import type { Banner, BannerDismissal, BannerRoute } from '../types';

const COLLECTION = 'banners';
const DISMISSALS = 'banner_dismissals';
const VALID_ROUTES: BannerRoute[] = ['home', 'profile', 'lojinha', 'chat'];
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BANNER_SIZE = 5 * 1024 * 1024; // 5 MB
const bannerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BANNER_SIZE } });

export const bannersRouter: Router = Router();

/** GET /banners/active — public. Returns `{ banner: Banner | null }`.
 *  "No active banner" is a normal state, not an error: returning 200 with
 *  null keeps the browser console clean (404 looks like a broken request). */
bannersRouter.get('/active', async (_req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection(COLLECTION)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    if (snap.empty) {
      res.status(200).json({ banner: null });
      return;
    }
    const banner = snap.docs[0]!.data() as Banner;
    res.status(200).json({ banner });
  } catch (err) {
    console.error('[GET /banners/active]', err);
    res.status(500).json({ error: 'get_active_banner_failed' });
  }
});

/** GET /banners/all — admin, lists all banners ordered by createdAt desc */
bannersRouter.get(
  '/all',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb.collection(COLLECTION)
        .orderBy('createdAt', 'desc')
        .get();
      const banners = snap.docs.map((d) => d.data() as Banner);
      res.status(200).json({ banners });
    } catch {
      res.status(500).json({ error: 'list_banners_failed' });
    }
  },
);

/** GET /banners/dismissal — authenticated, check if user dismissed a banner version */
bannersRouter.get(
  '/dismissal',
  requireAuth,
  async (req: Request, res: Response) => {
    const { bannerId, version } = req.query as { bannerId?: string; version?: string };
    if (!bannerId || !version) {
      res.status(400).json({ error: 'bannerId and version are required' });
      return;
    }
    const bannerVersion = parseInt(version, 10);
    if (isNaN(bannerVersion)) {
      res.status(400).json({ error: 'version must be a number' });
      return;
    }
    try {
      const docId = `${req.user!.uid}_${bannerId}`;
      const snap = await adminDb.collection(DISMISSALS).doc(docId).get();
      if (!snap.exists) {
        res.status(200).json({ dismissed: false });
        return;
      }
      const dismissal = snap.data() as BannerDismissal;
      const dismissed =
        dismissal.bannerVersion === bannerVersion &&
        dismissal.expiresAt > Date.now();
      res.status(200).json({ dismissed });
    } catch {
      res.status(500).json({ error: 'check_dismissal_failed' });
    }
  },
);

/** POST /banners/upload — admin, upload banner image to R2, returns URL */
bannersRouter.post(
  '/upload',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  bannerUpload.single('file'),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'file_required' });
      return;
    }
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      res.status(400).json({ error: 'invalid_mime' });
      return;
    }
    try {
      const ext = file.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : file.mimetype.split('/')[1]!;
      const objectKey = `banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const client = createR2Client();
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      const imageUrl = getR2PublicUrl(objectKey);
      res.status(200).json({ imageUrl });
    } catch {
      res.status(500).json({ error: 'upload_failed' });
    }
  },
);

/** POST /banners — admin, create banner */
bannersRouter.post(
  '/',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { imageUrl, altText, link, routes, autoDismissSeconds, reappearAfterDismissMs } = req.body as {
      imageUrl?: string;
      altText?: string;
      link?: string;
      routes?: BannerRoute[];
      autoDismissSeconds?: number;
      reappearAfterDismissMs?: number;
    };
    if (!imageUrl || typeof imageUrl !== 'string') {
      res.status(400).json({ error: 'imageUrl is required' });
      return;
    }
    if (!altText || typeof altText !== 'string') {
      res.status(400).json({ error: 'altText is required' });
      return;
    }
    if (link !== undefined && link !== null && !link.startsWith('https://')) {
      res.status(400).json({ error: 'link must start with https://' });
      return;
    }
    const resolvedRoutes: BannerRoute[] = routes ?? ['home'];
    if (!Array.isArray(resolvedRoutes) || resolvedRoutes.some((r) => !VALID_ROUTES.includes(r))) {
      res.status(400).json({ error: 'routes must be an array of valid BannerRoute values' });
      return;
    }
    try {
      const now = Date.now();
      const ref = adminDb.collection(COLLECTION).doc();
      const banner: Banner = {
        id: ref.id,
        imageUrl: imageUrl.trim(),
        altText: altText.trim(),
        link: link ? link.trim() : null,
        isActive: false,
        routes: resolvedRoutes,
        autoDismissSeconds: autoDismissSeconds ?? null,
        reappearAfterDismissMs: reappearAfterDismissMs ?? null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await ref.set(banner);
      res.status(201).json({ banner });
    } catch {
      res.status(500).json({ error: 'create_banner_failed' });
    }
  },
);

/** POST /banners/dismiss — authenticated, record user dismissal */
bannersRouter.post(
  '/dismiss',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    const { bannerId, bannerVersion } = req.body as {
      bannerId?: string;
      bannerVersion?: number;
    };
    if (!bannerId || typeof bannerId !== 'string' || bannerId.length > 128) {
      res.status(400).json({ error: 'bannerId is required (max 128 chars)' });
      return;
    }
    if (typeof bannerVersion !== 'number') {
      res.status(400).json({ error: 'bannerVersion is required' });
      return;
    }
    try {
      // Verify banner exists and get reappearance config
      const bannerSnap = await adminDb.collection(COLLECTION).doc(bannerId).get();
      if (!bannerSnap.exists) {
        res.status(404).json({ error: 'banner_not_found' });
        return;
      }
      const banner = bannerSnap.data() as Banner;
      const reappearMs = banner.reappearAfterDismissMs ?? 2 * 60 * 60 * 1000; // 2 hours default
      const now = Date.now();
      const docId = `${req.user!.uid}_${bannerId}`;
      const dismissal: BannerDismissal = {
        id: docId,
        userId: req.user!.uid,
        bannerId,
        bannerVersion,
        dismissedAt: now,
        expiresAt: now + reappearMs,
      };
      await adminDb.collection(DISMISSALS).doc(docId).set(dismissal);
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'dismiss_banner_failed' });
    }
  },
);

/** PUT /banners/:id/activate — admin, set this banner active, deactivate all others */
bannersRouter.put(
  '/:id/activate',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const targetRef = adminDb.collection(COLLECTION).doc(req.params.id!);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        res.status(404).json({ error: 'banner_not_found' });
        return;
      }
      const activeSnap = await adminDb.collection(COLLECTION)
        .where('isActive', '==', true)
        .get();
      const batch = adminDb.batch();
      const now = Date.now();
      activeSnap.docs.forEach((d) => {
        if (d.id !== req.params.id) {
          batch.update(d.ref, { isActive: false, updatedAt: now });
        }
      });
      const currentVersion = (targetSnap.data() as Banner).version;
      batch.update(targetRef, { isActive: true, version: currentVersion + 1, updatedAt: now });
      await batch.commit();
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'activate_banner_failed' });
    }
  },
);

/** PUT /banners/:id/deactivate — admin, set banner inactive */
bannersRouter.put(
  '/:id/deactivate',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const ref = adminDb.collection(COLLECTION).doc(req.params.id!);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'banner_not_found' });
        return;
      }
      await ref.update({ isActive: false, updatedAt: Date.now() });
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'deactivate_banner_failed' });
    }
  },
);

/** PUT /banners/:id — admin, update banner fields */
bannersRouter.put(
  '/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { imageUrl, link, altText, routes, autoDismissSeconds, reappearAfterDismissMs } = req.body as {
      imageUrl?: string;
      link?: string | null;
      altText?: string;
      routes?: BannerRoute[];
      autoDismissSeconds?: number | null;
      reappearAfterDismissMs?: number | null;
    };
    if (link !== undefined && link !== null && !link.startsWith('https://')) {
      res.status(400).json({ error: 'link must start with https://' });
      return;
    }
    if (routes !== undefined && (!Array.isArray(routes) || routes.some((r) => !VALID_ROUTES.includes(r)))) {
      res.status(400).json({ error: 'routes must be an array of valid BannerRoute values' });
      return;
    }
    try {
      const ref = adminDb.collection(COLLECTION).doc(req.params.id!);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'banner_not_found' });
        return;
      }
      const update: Record<string, unknown> = { updatedAt: Date.now() };
      if (typeof imageUrl === 'string') update.imageUrl = imageUrl.trim();
      if (link !== undefined) update.link = link ? link.trim() : null;
      if (typeof altText === 'string') update.altText = altText.trim();
      if (routes !== undefined) update.routes = routes;
      if (autoDismissSeconds !== undefined) update.autoDismissSeconds = autoDismissSeconds;
      if (reappearAfterDismissMs !== undefined) update.reappearAfterDismissMs = reappearAfterDismissMs;
      await ref.update(update);
      const updated = { ...(snap.data() as Banner), ...update };
      res.status(200).json({ banner: updated });
    } catch {
      res.status(500).json({ error: 'update_banner_failed' });
    }
  },
);

/** DELETE /banners/:id — admin, delete banner */
bannersRouter.delete(
  '/:id',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const ref = adminDb.collection(COLLECTION).doc(req.params.id!);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'banner_not_found' });
        return;
      }
      await ref.delete();
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'delete_banner_failed' });
    }
  },
);
