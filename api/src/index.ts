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

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Trust proxy for Render/reverse-proxy deployments (required by express-rate-limit).
app.set('trust proxy', 1);
// TODO: quando colocar em produção será necessário mudar isso, provavelmente é melhor receber de ENV.
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://teste-qbh.web.app', 'https://teste-qbh.firebaseapp.com', 'https://pwa-web-njxj.onrender.com']
    : true,
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

if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'preflight') {
  app.listen(PORT, () => {

    console.log(`[api] listening on :${PORT}`);
  });
}

export default app;
