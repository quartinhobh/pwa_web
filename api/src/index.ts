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

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
     
    console.log(`[api] listening on :${PORT}`);
  });
}

export default app;
