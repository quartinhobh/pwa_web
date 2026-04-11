import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import { adminDb } from '../config/firebase';
import { createR2Client, getR2PublicUrl, R2_BUCKET } from '../config/r2';
import type { FavoriteAlbum, SocialLink, SocialPlatform, User, UserRole } from '../types';
import { sendEmail, wrapTransactionalTemplate } from '../services/emailService';
import { buildRsvpEmail } from '../services/emailTemplateService';

async function sendRoleEmail(
  key: 'role_invite' | 'role_promotion',
  email: string,
  nome: string,
  role: string,
): Promise<void> {
  try {
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://teste-qbh.web.app';
    const roleName = role === 'admin' ? 'administrador' : 'moderador';
    const result = await buildRsvpEmail(key, { nome, role: roleName, link: `${frontendUrl}/admin` });
    if (!result) return;
    const html = wrapTransactionalTemplate(`<p>${result.bodyText.replace(/\n/g, '<br>')}</p>`);
    await sendEmail(email, result.subject, html);
  } catch (err) {
    console.error(`[users] ${key} email failed:`, err);
  }
}

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AVATAR_SIZE } });

const VALID_PLATFORMS: readonly SocialPlatform[] = ['instagram', 'spotify', 'twitter', 'lastfm', 'letterboxd'];

export const usersRouter: Router = Router();

/** GET /users — list all users (admin only) */
usersRouter.get(
  '/',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb.collection('users').get();
      const users = snap.docs
        .map((d) => {
          const data = d.data() as Partial<User>;
          return { ...data, id: data.id ?? d.id } as User;
        })
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      res.status(200).json({ users });
    } catch (err) {
      console.error('[GET /users]', err);
      res.status(500).json({ error: 'list_users_failed' });
    }
  },
);

/** PUT /users/:id/role — update a user's role (admin only) */
usersRouter.put(
  '/:id/role',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { role } = req.body as { role?: string };
    const allowed: UserRole[] = ['user', 'moderator', 'admin'];
    if (!role || !allowed.includes(role as UserRole)) {
      res.status(400).json({ error: 'invalid_role' });
      return;
    }
    try {
      const ref = adminDb.collection('users').doc(req.params.id!);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      const prevRole = (snap.data() as User).role;
      await ref.update({ role, updatedAt: Date.now() });

      // Auto-email when promoting to admin or moderator
      if ((role === 'admin' || role === 'moderator') && prevRole !== role) {
        const user = snap.data() as User;
        if (user.email) {
          void sendRoleEmail('role_promotion', user.email, user.displayName ?? 'você', role);
        }
      }

      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'update_role_failed' });
    }
  },
);

/** GET /users/invites — list pending role invites (admin only) */
usersRouter.get(
  '/invites',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb.collection('role_invites').get();
      const invites = snap.docs.map((d) => ({ email: d.id, role: (d.data() as { role: UserRole }).role }));
      res.status(200).json({ invites });
    } catch {
      res.status(500).json({ error: 'list_invites_failed' });
    }
  },
);

/** POST /users/invites — create a role invite by email (admin only) */
usersRouter.post(
  '/invites',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { email, role } = req.body as { email?: string; role?: string };
    const allowed: UserRole[] = ['user', 'moderator', 'admin'];
    if (!email || !role || !allowed.includes(role as UserRole)) {
      res.status(400).json({ error: 'invalid_email_or_role' });
      return;
    }
    try {
      await adminDb.collection('role_invites').doc(email).set({ role, createdAt: Date.now() });

      // Envia email de convite automaticamente (usa displayName do usuário existente se já cadastrado)
      let nome = 'você';
      const existing = await adminDb.collection('users').where('email', '==', email).limit(1).get();
      if (!existing.empty) {
        const u = existing.docs[0]!.data() as User;
        if (u.displayName) nome = u.displayName;
      }
      void sendRoleEmail('role_invite', email, nome, role);

      res.status(201).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'create_invite_failed' });
    }
  },
);

/** DELETE /users/invites/:email — remove a pending invite (admin only) */
usersRouter.delete(
  '/invites/:email',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      await adminDb.collection('role_invites').doc(req.params.email!).delete();
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'delete_invite_failed' });
    }
  },
);

// ── User Profile ─────────────────────────────────────────────────────

/** GET /users/username/:username — public profile by username (must be before /:id) */
usersRouter.get('/username/:username', async (req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection('users')
      .where('username', '==', req.params.username!.toLowerCase())
      .limit(1)
      .get();
    if (snap.empty) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    const u = snap.docs[0]!.data() as User;
    res.status(200).json({
      id: u.id,
      displayName: u.displayName,
      username: u.username ?? null,
      avatarUrl: u.avatarUrl ?? null,
      bio: u.bio ?? null,
      socialLinks: u.socialLinks ?? [],
      favoriteAlbums: u.favoriteAlbums ?? [],
    });
  } catch {
    res.status(500).json({ error: 'profile_fetch_failed' });
  }
});

/** GET /users/:id/profile — public profile by UID */
usersRouter.get('/:id/profile', async (req: Request, res: Response) => {
  try {
    const snap = await adminDb.collection('users').doc(req.params.id!).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }
    const u = snap.data() as User;
    res.status(200).json({
      id: u.id,
      displayName: u.displayName,
      username: u.username ?? null,
      avatarUrl: u.avatarUrl ?? null,
      bio: u.bio ?? null,
      socialLinks: u.socialLinks ?? [],
      favoriteAlbums: u.favoriteAlbums ?? [],
    });
  } catch {
    res.status(500).json({ error: 'profile_fetch_failed' });
  }
});

/** PUT /users/me/profile — update own displayName, bio, socialLinks, username */
usersRouter.put(
  '/me/profile',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    const { displayName, bio, socialLinks, username, favoriteAlbums } = req.body as {
      displayName?: string;
      bio?: string;
      socialLinks?: SocialLink[];
      username?: string | null;
      favoriteAlbums?: FavoriteAlbum[];
    };

    const update: Record<string, unknown> = { updatedAt: Date.now() };

    if (typeof displayName === 'string') {
      const trimmed = displayName.trim();
      if (trimmed.length < 1 || trimmed.length > 50) {
        res.status(400).json({ error: 'displayName must be 1-50 chars' });
        return;
      }
      update.displayName = trimmed;
    }

    // Username validation
    if (username !== undefined) {
      if (username === null || username === '') {
        update.username = null;
      } else {
        const trimmedUsername = username.trim().toLowerCase();
        if (!/^[a-z0-9_-]{3,20}$/.test(trimmedUsername)) {
          res.status(400).json({ error: 'username_invalid', detail: 'Username deve ter 3-20 caracteres (letras minúsculas, números, _ ou -)' });
          return;
        }
        const existing = await adminDb.collection('users')
          .where('username', '==', trimmedUsername)
          .limit(1)
          .get();
        if (!existing.empty && existing.docs[0]!.id !== req.user!.uid) {
          res.status(409).json({ error: 'username_taken', detail: 'Esse username já está em uso' });
          return;
        }
        update.username = trimmedUsername;
      }
    }

    if (typeof bio === 'string') {
      const trimmedBio = bio.trim();
      if (trimmedBio.length > 200) {
        res.status(400).json({ error: 'bio must be ≤200 chars' });
        return;
      }
      update.bio = trimmedBio;
    }

    if (Array.isArray(socialLinks)) {
      for (const link of socialLinks) {
        if (!VALID_PLATFORMS.includes(link.platform)) {
          res.status(400).json({ error: `invalid platform: ${link.platform}` });
          return;
        }
        if (typeof link.url !== 'string' || link.url.length > 300 ||
            !link.url.startsWith('https://')) {
          res.status(400).json({ error: 'invalid social link url — must start with https://' });
          return;
        }
      }
      update.socialLinks = socialLinks;
    }

    if (Array.isArray(favoriteAlbums)) {
      if (favoriteAlbums.length > 4) {
        res.status(400).json({ error: 'favoriteAlbums max 4' });
        return;
      }
      const seen = new Set<string>();
      for (const album of favoriteAlbums) {
        if (!album.mbId || typeof album.mbId !== 'string' ||
            !album.title || typeof album.title !== 'string' ||
            !album.artistCredit || typeof album.artistCredit !== 'string') {
          res.status(400).json({ error: 'invalid favorite album entry' });
          return;
        }
        if (seen.has(album.mbId)) {
          res.status(400).json({ error: 'duplicate favorite album' });
          return;
        }
        seen.add(album.mbId);
      }
      update.favoriteAlbums = favoriteAlbums.map((a) => ({
        mbId: a.mbId,
        title: a.title,
        artistCredit: a.artistCredit,
        coverUrl: (typeof a.coverUrl === 'string' && a.coverUrl.startsWith('https://')) ? a.coverUrl : null,
      }));
    }

    try {
      await adminDb.collection('users').doc(req.user.uid).set(update, { merge: true });
      res.status(200).json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error('[profile] update failed:', msg);
      res.status(500).json({ error: 'profile_update_failed', detail: msg });
    }
  },
);

/** PUT /users/me/avatar — upload avatar image to R2 */
usersRouter.put(
  '/me/avatar',
  writeLimiter,
  requireAuth,
  avatarUpload.single('file'),
  async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' });
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
      // Resize to 256x256, output JPEG for universal browser support
      const resized = await sharp(file.buffer)
        .resize(256, 256, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();

      const objectKey = `avatars/${req.user.uid}-${Date.now()}.jpg`;

      const client = createR2Client();
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: objectKey,
          Body: resized,
          ContentType: 'image/jpeg',
          Metadata: { uploadedBy: req.user.uid },
        }),
      );
      const avatarUrl = getR2PublicUrl(objectKey);

      // Read previous avatarUrl so we can delete the old object after the new one is live
      const userRef = adminDb.collection('users').doc(req.user.uid);
      const prevSnap = await userRef.get();
      const prevUrl = prevSnap.exists ? (prevSnap.data()?.avatarUrl as string | null | undefined) : null;

      // Use set+merge so it works even if user doc doesn't exist yet
      await userRef.set(
        { avatarUrl, updatedAt: Date.now() },
        { merge: true },
      );

      // Best-effort cleanup of the previous object (don't fail the request if this errors)
      if (prevUrl && typeof prevUrl === 'string') {
        const match = prevUrl.match(/avatars\/[^?#]+/);
        const prevKey = match?.[0];
        if (prevKey && prevKey !== objectKey) {
          try {
            await client.send(
              new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: prevKey }),
            );
          } catch (delErr) {
            console.warn('[avatar] failed to delete previous object:', prevKey, delErr);
          }
        }
      }
      res.status(200).json({ avatarUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error('[avatar] upload failed:', msg);
      res.status(500).json({ error: 'avatar_upload_failed', detail: msg });
    }
  },
);
