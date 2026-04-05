import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { globalLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth';
import { eventsRouter } from './routes/events';
import { musicbrainzRouter } from './routes/musicbrainz';
import { lyricsRouter } from './routes/lyrics';

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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on :${PORT}`);
  });
}

export default app;
