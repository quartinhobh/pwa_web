import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'quartinho-api' });
});

// Routes are added by feature-builder in Phase 3.

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on :${PORT}`);
  });
}

export default app;
