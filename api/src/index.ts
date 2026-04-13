import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { globalLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth';
import { eventsRouter } from './routes/events';
import { musicbrainzRouter } from './routes/musicbrainz';
import { lyricsRouter } from './routes/lyrics';
import { votesRouter } from './routes/votes';
import { moderationRouter } from './routes/moderation';
import { photosRouter } from './routes/photos';
import { shopRouter } from './routes/shop';
import { usersRouter } from './routes/users';
import { emailRouter } from './routes/email';
import { linktreeRouter } from './routes/linktree';
import { bannersRouter } from './routes/banners';
import { stickerConfigRouter } from './routes/stickerConfig';
import { userStatsRouter } from './routes/userStats';
import { chatRouter } from './routes/chat';
import { startEmailScheduler } from './jobs/emailScheduler';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Trust proxy for Render/reverse-proxy deployments (required by express-rate-limit).
app.set('trust proxy', 1);
const hardcodedOrigins = [
  'https://teste-qbh.web.app',
  'https://teste-qbh.firebaseapp.com',
  'https://quartinhobh.web.app',
  'https://quartinhobh.firebaseapp.com',
  'https://pwa-web-njxj.onrender.com'
];
const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [...hardcodedOrigins, ...envOrigins]
  : true;

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(globalLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'quartinho-api' });
});

app.use('/auth', authRouter);
app.use('/events', eventsRouter);
app.use('/mb', musicbrainzRouter);
app.use('/lyrics', lyricsRouter);
app.use('/votes', votesRouter);
app.use('/moderation', moderationRouter);
app.use('/photos', photosRouter);
app.use('/shop', shopRouter);
app.use('/users', usersRouter);
app.use('/email', emailRouter);
app.use('/linktree', linktreeRouter);
app.use('/banners', bannersRouter);
app.use('/sticker-config', stickerConfigRouter);
app.use('/user-stats', userStatsRouter);
app.use('/chat', chatRouter);

if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'preflight') {
  app.listen(PORT, () => {

    console.log(`[api] listening on :${PORT}`);
  });
  startEmailScheduler();
}

export default app;
