import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import SuggestionStatusTabs from '@/components/bares/SuggestionStatusTabs';
import { useAlbumSuggestions } from '@/hooks/useAlbumSuggestions';
import {
  updateAlbumSuggestionStatus,
  deleteAlbumSuggestion,
} from '@/services/api';
import { STATUS_DISPLAY } from '@/types';
import type { AlbumSuggestion, SuggestionStatus } from '@/types';

const STATUS_LABELS: SuggestionStatus[] = ['suggested', 'liked', 'disliked'];

export interface AlbumSuggestionsPanelProps {
  idToken: string;
}

function AlbumCover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="relative h-16 w-16 border-2 border-zine-burntYellow bg-zine-periwinkle/40 dark:bg-zine-periwinkle-dark/40 shrink-0 overflow-hidden">
      {!loaded && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-zine-periwinkle/60 to-zine-burntYellow/40 animate-pulse"
          style={{ filter: 'blur(8px)' }}
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}

function AlbumCard({ album }: { album: AlbumSuggestion }) {
  const hasData =
    album.albumTitle ||
    album.artistName ||
    album.coverUrl ||
    album.spotifyUrl ||
    album.youtubeUrl ||
    album.instagramLink ||
    album.notes;

  const altText = album.albumTitle && album.artistName
    ? `capa de ${album.albumTitle} - ${album.artistName}`
    : '';

  return (
    <div className="flex flex-col gap-2">
      {hasData ? (
        <>
          {/* Cover + title/artist */}
          <div className="flex items-start gap-3">
            {album.coverUrl && (
              <AlbumCover src={album.coverUrl} alt={altText} />
            )}
            <div className="flex flex-col min-w-0">
              {album.albumTitle && (
                <span className="font-body text-sm font-bold text-zine-burntOrange dark:text-zine-cream truncate">
                  {album.albumTitle}
                </span>
              )}
              {album.artistName && (
                <span className="font-body text-xs text-zine-burntOrange/70 dark:text-zine-cream/70 truncate">
                  {album.artistName}
                </span>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-1">
            {album.spotifyUrl && (
              <a
                href={album.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-xs text-zine-burntOrange underline hover:text-zine-burntOrange/70 break-all"
              >
                Spotify
              </a>
            )}
            {album.youtubeUrl && (
              <a
                href={album.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-xs text-zine-burntOrange underline hover:text-zine-burntOrange/70 break-all"
              >
                YouTube
              </a>
            )}
            {album.instagramLink && (
              <a
                href={album.instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-xs text-zine-burntOrange underline hover:text-zine-burntOrange/70 break-all"
              >
                Instagram (legado)
              </a>
            )}
          </div>

          {/* Notes */}
          {album.notes && (
            <p className="font-body text-xs text-zine-burntOrange/80 line-clamp-2">
              {album.notes}
            </p>
          )}
        </>
      ) : (
        <span className="font-body text-xs text-zine-burntOrange/50 italic">
          sugestao sem dados — ID: {album.id.slice(0, 8)}
        </span>
      )}
    </div>
  );
}

export const AlbumSuggestionsPanel: React.FC<AlbumSuggestionsPanelProps> = ({ idToken }) => {
  const [activeStatus, setActiveStatus] = useState<SuggestionStatus>('suggested');
  const { albums, loading, error, refresh } = useAlbumSuggestions(activeStatus, idToken);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleMoveStatus(id: string, status: SuggestionStatus) {
    setActionError(null);
    try {
      await updateAlbumSuggestionStatus(id, status, idToken);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'erro ao mover status');
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await deleteAlbumSuggestion(id, idToken);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'erro ao apagar disco');
    }
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('pt-BR');
  }

  return (
    <ZineFrame bg="cream">
      <h2 className="font-display text-xl text-zine-burntOrange mb-2">Discos sugeridos</h2>
      <p className="font-body text-xs text-zine-burntOrange/70 mb-3 italic">
        as abas abaixo são sua curadoria. mova entre elas conforme seu critério.
      </p>

      <div className="mb-4">
        <Link to="/sugerir-disco">
          <Button type="button" className="w-full">
            indicar disco →
          </Button>
        </Link>
      </div>

      <div className="mb-3">
        <SuggestionStatusTabs activeStatus={activeStatus} onChange={setActiveStatus} />
      </div>

      {loading && (
        <p
          role="status"
          aria-live="polite"
          className="font-body italic text-zine-burntOrange/70"
        >
          carregando...
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
      {actionError && (
        <p
          role="alert"
          aria-live="assertive"
          className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
        >
          {actionError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {albums.map((album) => (
          <ZineFrame key={album.id} bg="cream">
            <div className="flex flex-col gap-2">
              <AlbumCard album={album} />

              <div className="flex gap-2 items-center flex-wrap">
                {/* Badge — no rounded-full, plain border */}
                <span className="font-body text-xs px-2 py-0.5 border-2 border-zine-burntYellow text-zine-burntOrange">
                  {STATUS_DISPLAY[album.status]}
                </span>
                {album.suggestionCount > 1 && (
                  <span
                    className="font-body text-xs font-bold px-2 py-0.5 bg-zine-burntOrange text-zine-cream"
                    title="numero de pessoas que indicaram este disco"
                  >
                    indicado {album.suggestionCount}x
                  </span>
                )}
                <span className="font-body text-xs text-zine-burntOrange/60">
                  {formatDate(album.createdAt)}
                </span>
              </div>

              {album.suggestedByEmail ? (
                <p className="font-body text-xs text-zine-burntOrange/70">
                  por <a href={`mailto:${album.suggestedByEmail}`} className="underline break-all">{album.suggestedByEmail}</a>
                </p>
              ) : (
                <p className="font-body text-xs text-zine-burntOrange/50 italic">
                  por anônimo
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                {STATUS_LABELS.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    onClick={() => void handleMoveStatus(album.id, status)}
                    className="text-xs min-h-[44px]"
                  >
                    {STATUS_DISPLAY[status]}
                  </Button>
                ))}
                <Button
                  type="button"
                  onClick={() => void handleDelete(album.id)}
                  className="text-xs min-h-[44px]"
                >
                  apagar
                </Button>
              </div>
            </div>
          </ZineFrame>
        ))}
        {!loading && albums.length === 0 && (
          <p className="font-body italic text-zine-burntOrange/70">
            nenhum disco nessa aba.
          </p>
        )}
      </div>
    </ZineFrame>
  );
};

export default AlbumSuggestionsPanel;
