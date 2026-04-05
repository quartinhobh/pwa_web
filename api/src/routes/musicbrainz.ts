// MusicBrainz proxy routes — P3-B. Public reads, globalLimiter applied app-wide.

import { Router, type Request, type Response } from 'express';
import {
  fetchAlbum,
  fetchReleaseGroupTracks,
} from '../services/musicbrainzService';

export const musicbrainzRouter: Router = Router();

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
      const tracks = await fetchReleaseGroupTracks(req.params.mbid!);
      res.status(200).json({ tracks });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'mb_failed';
      const status = msg.startsWith('musicbrainz_4') ? 404 : 502;
      res.status(status).json({ error: msg });
    }
  },
);
