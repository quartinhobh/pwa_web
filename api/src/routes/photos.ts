// Photo routes — P3-G.
// Upload (admin, multipart), delete (admin), list (public).

import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import { deletePhoto, listPhotos, uploadPhoto } from '../services/photoService';
import type { PhotoCategory } from '../types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

function isCategory(value: string | undefined): value is PhotoCategory {
  return value === 'category1' || value === 'category2';
}

export const photosRouter: Router = Router();

// Public list — any visitor can view past-event photos.
photosRouter.get('/:eventId', async (req: Request, res: Response) => {
  try {
    const photos = await listPhotos(req.params.eventId!);
    res.status(200).json({ photos });
  } catch {
    res.status(500).json({ error: 'list_failed' });
  }
});

photosRouter.post(
  '/:eventId/:category/upload',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    const category = req.params.category;
    if (!isCategory(category)) {
      res.status(400).json({ error: 'invalid_category' });
      return;
    }
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
      const photo = await uploadPhoto(
        req.params.eventId!,
        category,
        req.user!.uid,
        file.buffer,
        file.mimetype,
      );
      res.status(201).json({ photo });
    } catch {
      res.status(500).json({ error: 'upload_failed' });
    }
  },
);

photosRouter.delete(
  '/:eventId/:category/:photoId',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const category = req.params.category;
    if (!isCategory(category)) {
      res.status(400).json({ error: 'invalid_category' });
      return;
    }
    try {
      const ok = await deletePhoto(
        req.params.eventId!,
        category,
        req.params.photoId!,
      );
      if (!ok) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'delete_failed' });
    }
  },
);
