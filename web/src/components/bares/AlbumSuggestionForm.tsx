import React, { useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import MbResultsList from '@/components/common/MbResultsList';
import { useMusicBrainzSearch } from '@/hooks/useMusicBrainzSearch';
import { createAlbumSuggestion } from '@/services/api';
import type { MbSearchResult } from '@/services/api';

export interface AlbumSuggestionFormProps {
  idToken?: string | null;
  onSuccess?: () => void;
}

interface MbSelection {
  mbid: string;
  title: string;
  artistCredit: string;
  coverUrl: string | null;
}

export const AlbumSuggestionForm: React.FC<AlbumSuggestionFormProps> = ({ idToken, onSuccess }) => {
  const [mbSelection, setMbSelection] = useState<MbSelection | null>(null);
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { query, setQuery, results, searching, reset: resetAlbumSearch } = useMusicBrainzSearch();

  function handleSelectAlbum(r: MbSearchResult) {
    setMbSelection({
      mbid: r.id,
      title: r.title,
      artistCredit: r.artistCredit,
      coverUrl: r.coverUrl,
    });
    resetAlbumSearch();
  }

  function handleClearSelection() {
    setMbSelection(null);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setError(null);

    const hasSelection = mbSelection !== null;
    const hasSpotify = spotifyUrl.trim().length > 0;
    const hasYoutube = youtubeUrl.trim().length > 0;
    const hasTitle = albumTitle.trim().length > 0;

    if (!hasSelection && !hasSpotify && !hasYoutube && !hasTitle) {
      setValidationError('preencha pelo menos uma forma de identificar o disco');
      return;
    }

    setBusy(true);
    try {
      if (mbSelection) {
        await createAlbumSuggestion(
          {
            mbid: mbSelection.mbid,
            albumTitle: mbSelection.title,
            artistName: mbSelection.artistCredit,
            notes: notes.trim() || null,
          },
          idToken,
        );
      } else {
        await createAlbumSuggestion(
          {
            spotifyUrl: spotifyUrl.trim() || null,
            youtubeUrl: youtubeUrl.trim() || null,
            albumTitle: albumTitle.trim() || null,
            artistName: artistName.trim() || null,
            notes: notes.trim() || null,
          },
          idToken,
        );
      }

      setMbSelection(null);
      setSpotifyUrl('');
      setYoutubeUrl('');
      setAlbumTitle('');
      setArtistName('');
      setNotes('');
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erro ao indicar disco');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ZineFrame bg="cream">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <h2 className="font-display text-xl text-zine-burntOrange">indicar disco</h2>

        {!mbSelection ? (
          <>
            {/* MusicBrainz search */}
            <div className="flex flex-col gap-1">
              <label
                className="font-body text-sm text-zine-burntOrange"
                htmlFor="album-mb-search"
              >
                buscar no MusicBrainz
              </label>
              <input
                id="album-mb-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ex: Rumours, Abbey Road…"
                className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
              />
              <MbResultsList
                results={results}
                searching={searching}
                onSelect={handleSelectAlbum}
                variant="compact"
              />
            </div>

            {/* Fallback section */}
            <p className="font-body text-xs text-zine-burntOrange/70 italic">
              se não achou automaticamente, preencher manual:
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label
                  className="font-body text-sm text-zine-burntOrange"
                  htmlFor="album-spotify-url"
                >
                  link do Spotify
                </label>
                <input
                  id="album-spotify-url"
                  type="url"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  aria-invalid={validationError ? 'true' : 'false'}
                  aria-describedby={validationError ? 'album-validation-error' : undefined}
                  placeholder="https://open.spotify.com/album/..."
                  className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  className="font-body text-sm text-zine-burntOrange"
                  htmlFor="album-youtube-url"
                >
                  link do YouTube
                </label>
                <input
                  id="album-youtube-url"
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  className="font-body text-sm text-zine-burntOrange"
                  htmlFor="album-title"
                >
                  titulo do album
                </label>
                <input
                  id="album-title"
                  type="text"
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  placeholder="ex: Rumours"
                  className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  className="font-body text-sm text-zine-burntOrange"
                  htmlFor="album-artist"
                >
                  artista
                </label>
                <input
                  id="album-artist"
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="ex: Fleetwood Mac"
                  className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow"
                />
              </div>
            </div>
          </>
        ) : (
          /* MB selection preview */
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 p-2 border-2 border-dashed border-zine-burntYellow">
              {mbSelection.coverUrl && (
                <img
                  src={mbSelection.coverUrl}
                  alt=""
                  className="h-16 w-16 object-cover border-2 border-zine-cream shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-body text-sm font-bold text-zine-burntOrange dark:text-zine-cream truncate">
                  {mbSelection.title}
                </span>
                <span className="font-body text-xs text-zine-burntOrange/60 dark:text-zine-cream/60 truncate">
                  {mbSelection.artistCredit}
                </span>
              </div>
            </div>
            <Button type="button" onClick={handleClearSelection} className="self-start text-xs">
              trocar
            </Button>
          </div>
        )}

        {/* Notes — always visible */}
        <div className="flex flex-col gap-1">
          <label
            className="font-body text-sm text-zine-burntOrange"
            htmlFor="album-notes"
          >
            observacoes (opcional)
          </label>
          <textarea
            id="album-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="por que voce curte esse disco?"
            className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zine-burntYellow resize-none"
          />
        </div>

        {validationError && (
          <span
            id="album-validation-error"
            role="alert"
            aria-live="assertive"
            className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
          >
            {validationError}
          </span>
        )}
        {success && (
          <p
            role="status"
            aria-live="polite"
            className="font-body text-sm text-zine-burntOrange"
          >
            disco indicado com sucesso!
          </p>
        )}
        {error && (
          <p
            role="alert"
            aria-live="assertive"
            className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? 'enviando...' : 'indicar disco'}
        </Button>
      </form>
    </ZineFrame>
  );
};

export default AlbumSuggestionForm;
