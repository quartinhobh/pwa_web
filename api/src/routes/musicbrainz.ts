// MusicBrainz proxy routes — P3-B. Public reads, globalLimiter applied app-wide.

import { Router, type Request, type Response } from 'express';
import {
  fetchAlbum,
  fetchTracks,
  searchReleases,
} from '../services/musicbrainzService';
import { lookupCoverByText } from '../services/coverLookupService';

export const musicbrainzRouter: Router = Router();

musicbrainzRouter.get('/search', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const year = typeof req.query.year === 'string' ? req.query.year.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'missing_query' });
    return;
  }
  try {
    const numberResearchedAlbums = 12;
    const results = await searchReleases(q, numberResearchedAlbums, year);
    res.status(200).json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'mb_search_failed';
    res.status(502).json({ error: msg });
  }
});

// Free-text cover lookup. Returns mbid + coverUrl when confident, null
// otherwise. See coverLookupService for matching/waterfall details. Callers
// who can persist the result should hit the dedicated enrich-cover endpoint
// on the suggestions resource — this one is read-only.
musicbrainzRouter.get('/cover-by-name', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'missing_query' });
    return;
  }
  try {
    const result = await lookupCoverByText(q);
    res.status(200).json(result ?? { mbid: null, coverUrl: null });
  } catch (err) {
    // Don't break the UI — degrade to "no cover".
    console.error('[GET /mb/cover-by-name]', err);
    res.status(200).json({ mbid: null, coverUrl: null });
  }
});

musicbrainzRouter.get('/album/:mbid', async (req: Request, res: Response) => {
  try {
    const release = await fetchAlbum(req.params.mbid!);
    res.status(200).json({ release });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'mb_failed';
    const status = msg.startsWith('musicbrainz_4') ? 404 : 502;
    res.status(status).json({ error: msg });
  }
});

musicbrainzRouter.get(
  '/release-groups/:mbid/tracks',
  async (req: Request, res: Response) => {
    try {
      const tracks = await fetchTracks(req.params.mbid!);
      res.status(200).json({ tracks });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'mb_failed';
      const status = msg.startsWith('musicbrainz_4') ? 404 : 502;
      res.status(status).json({ error: msg });
    }
  },
);
