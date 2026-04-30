import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import SuggestionStatusTabs from '@/components/bares/SuggestionStatusTabs';
import AdminSuggestionCard from '@/components/admin/AdminSuggestionCard';
import { useAlbumSuggestions } from '@/hooks/useAlbumSuggestions';
import { useMbCoverLookup } from '@/hooks/useMbCoverLookup';
import {
  updateAlbumSuggestionStatus,
  deleteAlbumSuggestion,
} from '@/services/api';
import type { AlbumSuggestion, SuggestionStatus } from '@/types';

export interface AlbumSuggestionsPanelProps {
  idToken: string;
}

function AlbumCover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div
      className={`h-14 w-14 overflow-hidden transition-opacity duration-300 ${
        loaded ? 'opacity-100 border-2 border-zine-burntYellow' : 'opacity-0'
      }`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function AlbumCardRow({
  album,
  idToken,
  onMoveStatus,
  onDelete,
}: {
  album: AlbumSuggestion;
  idToken: string;
  onMoveStatus: (status: SuggestionStatus) => void;
  onDelete: () => void;
}) {
  const resolvedCover = useMbCoverLookup(
    album.albumTitle,
    album.artistName,
    album.coverUrl,
    album.id,
    idToken,
  );
  const altText = album.albumTitle
    ? `capa de ${album.albumTitle}${album.artistName ? ` - ${album.artistName}` : ''}`
    : 'capa do disco';

  const meta: React.ReactNode[] = [];
  if (album.suggestionCount > 1) {
    meta.push(
      <span
        key="count"
        className="font-body text-xs font-bold px-2 py-0.5 bg-zine-burntOrange text-zine-cream"
        title="numero de pessoas que indicaram este disco"
      >
        ×{album.suggestionCount}
      </span>,
    );
  }
  if (album.spotifyUrl) {
    meta.push(
      <a
        key="spot"
        href={album.spotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-zine-burntOrange"
      >
        spotify
      </a>,
    );
  }
  if (album.youtubeUrl) {
    meta.push(
      <a
        key="yt"
        href={album.youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-zine-burntOrange"
      >
        youtube
      </a>,
    );
  }
  if (album.instagramLink) {
    meta.push(
      <a
        key="ig"
        href={album.instagramLink}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-zine-burntOrange"
      >
        ig
      </a>,
    );
  }
  meta.push(
    <span key="date">{new Date(album.createdAt).toLocaleDateString('pt-BR')}</span>,
  );
  meta.push(
    album.suggestedByEmail ? (
      <a
        key="by"
        href={`mailto:${album.suggestedByEmail}`}
        className="underline truncate max-w-[18ch]"
        title={album.suggestedByEmail}
      >
        {album.suggestedByEmail}
      </a>
    ) : (
      <span key="by" className="italic">
        anônimo
      </span>
    ),
  );

  return (
    <AdminSuggestionCard
      media={
        resolvedCover ? <AlbumCover src={resolvedCover} alt={altText} /> : undefined
      }
      title={album.albumTitle ?? `sugestao sem titulo (${album.id.slice(0, 8)})`}
      subtitle={album.artistName}
      metaItems={meta}
      notes={album.notes}
      status={album.status}
      onMoveStatus={onMoveStatus}
      onDelete={onDelete}
    />
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
          <AlbumCardRow
            key={album.id}
            album={album}
            idToken={idToken}
            onMoveStatus={(status) => void handleMoveStatus(album.id, status)}
            onDelete={() => void handleDelete(album.id)}
          />
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
