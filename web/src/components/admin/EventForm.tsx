import React, { useCallback, useEffect, useRef, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { createEvent, updateEvent, searchMusicBrainz, type MbSearchResult } from '@/services/api';
import type { Event } from '@/types';

export interface EventFormProps {
  mode: 'create' | 'edit';
  initial?: Event;
  idToken: string | null;
  onSaved?: (event: Event) => void;
}

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange';

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
  const extrasLinks = (initial?.extras?.links ?? []).map((l) => `${l.label}|${l.url}`).join('\n');
  const extrasImages = (initial?.extras?.images ?? []).join('\n');
  const [spotifyPlaylistUrl, setSpotifyPlaylistUrl] = useState(
    initial?.spotifyPlaylistUrl ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Album search ───────────────────────────────────────────────────
  const [albumQuery, setAlbumQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MbSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await searchMusicBrainz(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSearch(albumQuery), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [albumQuery, doSearch]);

  function selectAlbum(r: MbSearchResult) {
    setMbAlbumId(r.id);
    setTitle(r.title + (r.artistCredit ? ` — ${r.artistCredit}` : ''));
    setSelectedCover(r.coverUrl);
    setAlbumQuery('');
    setSearchResults([]);
  }

  // ── Submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!idToken) { setError('missing_token'); return; }
    setBusy(true);
    setError(null);
    try {
      const links = extrasLinks
        .split('\n').map((l) => l.trim()).filter(Boolean)
        .map((l) => { const [label, url] = l.split('|'); return { label: (label ?? '').trim(), url: (url ?? '').trim() }; });
      const images = extrasImages.split('\n').map((s) => s.trim()).filter(Boolean);
      const payload = {
        mbAlbumId, title, date, startTime, endTime,
        location: location || null,
        extras: { text: extrasText, links, images },
        spotifyPlaylistUrl: spotifyPlaylistUrl || null,
      };
      const saved = mode === 'create'
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
      <form onSubmit={handleSubmit} aria-label="event-form" className="flex flex-col gap-3">
        <h3 className="font-display text-xl text-zine-burntOrange">
          {mode === 'create' ? 'Novo evento' : 'Editar evento'}
        </h3>

        {/* Album search */}
        <div className="flex flex-col gap-1">
          <label className="font-body text-zine-burntOrange dark:text-zine-cream">
            Buscar álbum
          </label>
          <input
            type="text"
            value={albumQuery}
            onChange={(e) => setAlbumQuery(e.target.value)}
            placeholder="ex: OK Computer, Abbey Road…"
            className={inputClass}
          />
          {searching && (
            <p className="font-body text-xs text-zine-burntOrange/60">buscando…</p>
          )}
          {searchResults.length > 0 && (
            <ul className="border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark max-h-64 overflow-y-auto">
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => selectAlbum(r)}
                    className="w-full text-left px-2 py-2 flex items-center gap-3 hover:bg-zine-mint dark:hover:bg-zine-mint-dark border-b border-zine-burntYellow/20"
                  >
                    <img
                      src={r.coverUrl ?? ''}
                      alt=""
                      className="w-10 h-10 object-cover border-2 border-zine-cream bg-zine-periwinkle"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-body font-bold text-zine-burntOrange dark:text-zine-cream text-sm truncate">
                        {r.title}
                      </span>
                      <span className="font-body text-xs text-zine-burntOrange/70 dark:text-zine-cream/70 truncate">
                        {r.artistCredit} {r.date ? `(${r.date.slice(0, 4)})` : ''}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected album preview */}
        {mbAlbumId && (
          <div className="flex items-center gap-3 p-2 border-2 border-dashed border-zine-burntYellow">
            {selectedCover && (
              <img
                src={selectedCover}
                alt="capa"
                className="w-16 h-16 object-cover border-2 border-zine-cream"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-body text-xs text-zine-burntOrange/60 dark:text-zine-cream/60">
                MBID selecionado
              </span>
              <span className="font-body text-sm text-zine-burntOrange dark:text-zine-cream font-bold truncate">
                {mbAlbumId}
              </span>
            </div>
          </div>
        )}

        <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
          <span>Título do evento</span>
          <input aria-label="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>

        <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
          <span>Data</span>
          <input type="date" aria-label="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
            <span>Início</span>
            <input type="time" aria-label="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
          </label>
          <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
            <span>Fim</span>
            <input type="time" aria-label="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          </label>
        </div>

        <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
          <span>Local</span>
          <input aria-label="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ex: Quartinho BH — Rua Exemplo, 123" className={inputClass} />
        </label>

        <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
          <span>Notas</span>
          <textarea aria-label="extras-text" value={extrasText} onChange={(e) => setExtrasText(e.target.value)} className={inputClass} />
        </label>

        <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
          <span>Spotify Playlist URL</span>
          <input aria-label="spotifyPlaylistUrl" value={spotifyPlaylistUrl} onChange={(e) => setSpotifyPlaylistUrl(e.target.value)} className={inputClass} />
        </label>

        {error && (
          <p role="alert" className="font-body text-zine-burntOrange">{error}</p>
        )}

        <Button type="submit" disabled={busy || !idToken}>
          {busy ? 'a guardar…' : mode === 'create' ? 'criar' : 'guardar'}
        </Button>
      </form>
    </ZineFrame>
  );
};

export default EventForm;
