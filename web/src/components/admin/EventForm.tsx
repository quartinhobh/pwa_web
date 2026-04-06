import React, { useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { createEvent, updateEvent } from '@/services/api';
import type { Event } from '@/types';

export interface EventFormProps {
  mode: 'create' | 'edit';
  initial?: Event;
  idToken: string | null;
  onSaved?: (event: Event) => void;
}

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange';

/**
 * EventForm — admin create/edit form for events.
 * All fields wrapped in a cream ZineFrame with burntYellow-bordered inputs.
 */
export const EventForm: React.FC<EventFormProps> = ({
  mode,
  initial,
  idToken,
  onSaved,
}) => {
  const [mbAlbumId, setMbAlbumId] = useState(initial?.mbAlbumId ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [extrasText, setExtrasText] = useState(initial?.extras?.text ?? '');
  const [extrasLinks, setExtrasLinks] = useState(
    (initial?.extras?.links ?? []).map((l) => `${l.label}|${l.url}`).join('\n'),
  );
  const [extrasImages, setExtrasImages] = useState(
    (initial?.extras?.images ?? []).join('\n'),
  );
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState(
    initial?.spotifyPlaylistUrl ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!idToken) {
      setError('missing_token');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const links = extrasLinks
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, url] = line.split('|');
          return { label: (label ?? '').trim(), url: (url ?? '').trim() };
        });
      const images = extrasImages
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        mbAlbumId,
        title,
        date,
        startTime,
        endTime,
        location: location || null,
        extras: { text: extrasText, links, images },
        spotifyPlaylistUrl: spotifyPlaylistUrl || null,
      };
      const saved =
        mode === 'create'
          ? await createEvent(payload, idToken)
          : await updateEvent(initial!.id, payload, idToken);
      onSaved?.(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ZineFrame bg="cream" borderColor="burntYellow">
      <form
        onSubmit={handleSubmit}
        aria-label="event-form"
        className="flex flex-col gap-3"
      >
        <h3 className="font-display text-xl text-zine-burntOrange">
          {mode === 'create' ? 'Novo evento' : 'Editar evento'}
        </h3>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>MusicBrainz Album ID</span>
          <input
            aria-label="mbAlbumId"
            value={mbAlbumId}
            onChange={(e) => setMbAlbumId(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Título</span>
          <input
            aria-label="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Data</span>
          <input
            type="date"
            aria-label="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Início</span>
          <input
            type="time"
            aria-label="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Fim</span>
          <input
            type="time"
            aria-label="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Local</span>
          <input
            aria-label="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="ex: Quartinho BH — Rua Exemplo, 123"
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Notas (extras)</span>
          <textarea
            aria-label="extras-text"
            value={extrasText}
            onChange={(e) => setExtrasText(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Links (label|url por linha)</span>
          <textarea
            aria-label="extras-links"
            value={extrasLinks}
            onChange={(e) => setExtrasLinks(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Imagens (uma URL por linha)</span>
          <textarea
            aria-label="extras-images"
            value={extrasImages}
            onChange={(e) => setExtrasImages(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="font-body text-zine-burntOrange flex flex-col gap-1">
          <span>Spotify Playlist URL</span>
          <input
            aria-label="spotifyPlaylistUrl"
            value={spotifyPlaylistUrl}
            onChange={(e) => setSpotifyPlaylistUrl(e.target.value)}
            className={inputClass}
          />
        </label>

        {error ? (
          <p role="alert" className="font-body text-zine-burntOrange">
            erro: {error}
          </p>
        ) : null}

        <Button type="submit" disabled={busy || !idToken}>
          {busy ? 'a guardar…' : mode === 'create' ? 'criar' : 'guardar'}
        </Button>
      </form>
    </ZineFrame>
  );
};

export default EventForm;
