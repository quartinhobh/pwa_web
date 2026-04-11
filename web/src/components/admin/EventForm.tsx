import React, { useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { auth } from '@/services/firebase';
import { createEvent, updateEvent, type MbSearchResult } from '@/services/api';
import { useIdToken } from '@/hooks/useIdToken';
import { useMusicBrainzSearch } from '@/hooks/useMusicBrainzSearch';
import MbResultsList from '@/components/common/MbResultsList';
import HelperBox from '@/components/admin/HelperBox';
import type { Event, RsvpApprovalMode } from '@/types';

export interface EventFormProps {
  mode: 'create' | 'edit';
  initial?: Event;
  idToken?: string | null; // deprecated — uses useIdToken() internally
  onSaved?: (event: Event) => void;
}

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange';

export const EventForm: React.FC<EventFormProps> = ({
  mode,
  initial,
  onSaved,
}) => {
  const idToken = useIdToken();
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

  // ── RSVP config ─────────────────────────────────────────────────────
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [rsvpEnabled, setRsvpEnabled] = useState(initial?.rsvp?.enabled ?? false);
  const [rsvpCapacity, setRsvpCapacity] = useState<string>(
    initial?.rsvp?.capacity != null ? String(initial.rsvp.capacity) : '',
  );
  const [rsvpWaitlist, setRsvpWaitlist] = useState(initial?.rsvp?.waitlistEnabled ?? false);
  const [rsvpPlusOne, setRsvpPlusOne] = useState(initial?.rsvp?.plusOneAllowed ?? false);
  const [rsvpApproval, setRsvpApproval] = useState<RsvpApprovalMode>(initial?.rsvp?.approvalMode ?? 'auto');
  const [rsvpOpensAt, setRsvpOpensAt] = useState<string>(
    initial?.rsvp?.opensAt ? new Date(initial.rsvp.opensAt).toISOString().slice(0, 16) : '',
  );
  const [rsvpClosesAt, setRsvpClosesAt] = useState<string>(
    initial?.rsvp?.closesAt ? new Date(initial.rsvp.closesAt).toISOString().slice(0, 16) : '',
  );

  // ── Album search ───────────────────────────────────────────────────
  const { query: albumQuery, setQuery: setAlbumQuery, results: searchResults, searching, reset: resetAlbumSearch } = useMusicBrainzSearch();
  const [selectedCover, setSelectedCover] = useState<string | null>(null);

  function selectAlbum(r: MbSearchResult) {
    setMbAlbumId(r.id);
    setTitle(r.title + (r.artistCredit ? ` — ${r.artistCredit}` : ''));
    setSelectedCover(r.coverUrl);
    resetAlbumSearch();
  }

  // ── Submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    // idToken from hook may still be null if Auth hasn't rehydrated.
    // Fall back to getting it directly from currentUser.
    let token = idToken;
    if (!token && auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
    if (!token) { setError('não autenticado — faça login primeiro'); return; }
    setBusy(true);
    setError(null);
    try {
      const links = extrasLinks
        .split('\n').map((l) => l.trim()).filter(Boolean)
        .map((l) => { const [label, url] = l.split('|'); return { label: (label ?? '').trim(), url: (url ?? '').trim() }; });
      const images = extrasImages.split('\n').map((s) => s.trim()).filter(Boolean);
      const rsvp = rsvpEnabled ? {
        enabled: true,
        capacity: rsvpCapacity ? Number(rsvpCapacity) : null,
        waitlistEnabled: rsvpWaitlist,
        plusOneAllowed: rsvpPlusOne,
        approvalMode: rsvpApproval,
        opensAt: rsvpOpensAt ? new Date(rsvpOpensAt).getTime() : null,
        closesAt: rsvpClosesAt ? new Date(rsvpClosesAt).getTime() : null,
      } : { enabled: false, capacity: null, waitlistEnabled: false, plusOneAllowed: false, approvalMode: 'auto' as const, opensAt: null, closesAt: null };
      const payload = {
        mbAlbumId, title, date, startTime, endTime,
        location: location || null,
        extras: { text: extrasText, links, images },
        spotifyPlaylistUrl: spotifyPlaylistUrl || null,
        rsvp,
      };
      const saved = mode === 'create'
        ? await createEvent(payload, token)
        : await updateEvent(initial!.id, payload, token);
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
        <HelperBox>Busque um álbum no MusicBrainz para associar ao evento. Preencha título, data, horários e local. O campo "Notas" é para informações extras. A playlist do Spotify aparece na página do evento.</HelperBox>

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
          <MbResultsList
            results={searchResults}
            searching={searching}
            onSelect={selectAlbum}
          />
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

        {/* RSVP config */}
        <div className="border-2 border-dashed border-zine-burntYellow">
          <button
            type="button"
            onClick={() => setRsvpOpen((v) => !v)}
            className="w-full text-left px-3 py-2 font-body font-bold text-zine-burntOrange flex items-center justify-between"
          >
            <span>RSVP</span>
            <span className="text-xs text-zine-burntOrange/60">{rsvpOpen ? '▲ fechar' : '▼ abrir'}</span>
          </button>
          {rsvpOpen && (
            <div className="px-3 pb-3 flex flex-col gap-3">
              <HelperBox>Ative o RSVP para controlar presença no evento. Capacidade limita quantas pessoas podem confirmar — quando enche, vai pra fila de espera (se ativada). Aprovação 'automática' confirma na hora, 'manual' deixa pendente pra você aprovar. +1 permite trazer acompanhante. 'Abre em' e 'Fecha em' controlam quando o RSVP fica disponível.</HelperBox>
              <label className="font-body text-zine-burntOrange flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label="rsvp-enabled"
                  checked={rsvpEnabled}
                  onChange={(e) => setRsvpEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Ativar RSVP</span>
              </label>

              {rsvpEnabled && (
                <>
                  <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
                    <span>Capacidade (vazio = ilimitado)</span>
                    <input
                      type="number"
                      aria-label="rsvp-capacity"
                      value={rsvpCapacity}
                      onChange={(e) => setRsvpCapacity(e.target.value)}
                      min={1}
                      placeholder="ex: 30"
                      className={inputClass}
                    />
                  </label>

                  <label className="font-body text-zine-burntOrange flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label="rsvp-waitlist"
                      checked={rsvpWaitlist}
                      onChange={(e) => setRsvpWaitlist(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Fila de espera</span>
                  </label>

                  <label className="font-body text-zine-burntOrange flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label="rsvp-plusone"
                      checked={rsvpPlusOne}
                      onChange={(e) => setRsvpPlusOne(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Permitir +1</span>
                  </label>

                  <fieldset className="flex flex-col gap-1">
                    <legend className="font-body text-zine-burntOrange mb-1">Aprovação</legend>
                    <label className="font-body text-zine-burntOrange flex items-center gap-2">
                      <input
                        type="radio"
                        name="rsvp-approval"
                        value="auto"
                        checked={rsvpApproval === 'auto'}
                        onChange={() => setRsvpApproval('auto')}
                      />
                      <span>Automática</span>
                    </label>
                    <label className="font-body text-zine-burntOrange flex items-center gap-2">
                      <input
                        type="radio"
                        name="rsvp-approval"
                        value="manual"
                        checked={rsvpApproval === 'manual'}
                        onChange={() => setRsvpApproval('manual')}
                      />
                      <span>Manual</span>
                    </label>
                  </fieldset>

                  <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
                    <span>Abre em (opcional)</span>
                    <input
                      type="datetime-local"
                      aria-label="rsvp-opens-at"
                      value={rsvpOpensAt}
                      onChange={(e) => setRsvpOpensAt(e.target.value)}
                      className={inputClass}
                    />
                  </label>

                  <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
                    <span>Fecha em (opcional)</span>
                    <input
                      type="datetime-local"
                      aria-label="rsvp-closes-at"
                      value={rsvpClosesAt}
                      onChange={(e) => setRsvpClosesAt(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="font-body text-zine-burntOrange">{error}</p>
        )}

        <Button type="submit" disabled={busy}>
          {busy ? 'a guardar…' : mode === 'create' ? 'criar' : 'guardar'}
        </Button>
      </form>
    </ZineFrame>
  );
};

export default EventForm;
