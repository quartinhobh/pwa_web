// MusicBrainz proxy routes — P3-B. Public reads, globalLimiter applied app-wide.

import { Router, type Request, type Response } from 'express';
import {
  fetchAlbum,
  fetchTracks,
  searchReleases,
} from '../services/musicbrainzService';
import { fetchCoverArt } from '../services/coverArtService';

export const musicbrainzRouter: Router = Router();

function normalizeForMatch(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

// Free-text cover lookup. Used by the admin suggestions panel: callers pass
// the suggestion's free-text title (which often packs "album - artist" into a
// single string). We search MB, accept the top hit only if both its title and
// artistCredit appear (normalized substring) in the user's query, then run
// the CAA → Deezer → Last.fm waterfall on that release. Returns null when not
// confident or no cover anywhere — callers render no media in that case.
musicbrainzRouter.get('/cover-by-name', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    res.status(400).json({ error: 'missing_query' });
    return;
  }
  try {
    const results = await searchReleases(q, 5, '');
    const top = results[0];
    if (!top) {
      res.status(200).json({ coverUrl: null });
      return;
    }
    const normQuery = normalizeForMatch(q);
    const normTitle = normalizeForMatch(top.title);
    const normArtist = normalizeForMatch(top.artistCredit);
    const confident =
      normTitle.length > 0 &&
      normArtist.length > 0 &&
      normQuery.includes(normTitle) &&
      normQuery.includes(normArtist);
    if (!confident) {
      res.status(200).json({ coverUrl: null });
      return;
    }
    const { coverUrl } = await fetchCoverArt({
      mbid: top.id,
      artistCredit: top.artistCredit,
      albumTitle: top.title,
    });
    res.status(200).json({ coverUrl });
  } catch (err) {
    // Don't break the UI — degrade to "no cover".
    console.error('[GET /mb/cover-by-name]', err);
    res.status(200).json({ coverUrl: null });
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
