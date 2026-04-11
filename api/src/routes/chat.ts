import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import { adminDb } from '../config/firebase';

export const chatRouter: Router = Router();

export interface ChatConfig {
  pauseAll: boolean;
  updatedAt: number;
}

const DEFAULT_CHAT_CONFIG: ChatConfig = {
  pauseAll: false,
  updatedAt: 0,
};

const COLLECTION = 'chat_config';
const DOC_ID = 'settings';

async function getChatConfig(): Promise<ChatConfig> {
  const snap = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return DEFAULT_CHAT_CONFIG;
  const data = snap.data() as Partial<ChatConfig>;
  return { ...DEFAULT_CHAT_CONFIG, ...data };
}

/** GET /chat/config — public-ish (any authed client may read, but we keep it open so LiveChat can consult without extra roundtrip). */
chatRouter.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await getChatConfig();
    res.status(200).json({ pauseAll: config.pauseAll });
  } catch (err) {
    console.error('[GET /chat/config]', err);
    res.status(500).json({ error: 'get_chat_config_failed' });
  }
});

/** PUT /chat/config — admin only. */
chatRouter.put(
  '/config',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const body = req.body as { pauseAll?: unknown };
    if (typeof body.pauseAll !== 'boolean') {
      res.status(400).json({ error: 'pauseAll must be boolean' });
      return;
    }
    try {
      const next: ChatConfig = {
        pauseAll: body.pauseAll,
        updatedAt: Date.now(),
      };
      await adminDb.collection(COLLECTION).doc(DOC_ID).set(next, { merge: true });
      res.status(200).json({ pauseAll: next.pauseAll });
    } catch (err) {
      console.error('[PUT /chat/config]', err);
      res.status(500).json({ error: 'update_chat_config_failed' });
    }
  },
);
