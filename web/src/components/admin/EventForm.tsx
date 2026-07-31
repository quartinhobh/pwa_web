import React, { useState, useMemo } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { auth } from '@/services/firebase';
import { createEvent, updateEvent, type MbSearchResult } from '@/services/api';
import { useIdToken } from '@/hooks/useIdToken';
import { useMusicBrainzSearch } from '@/hooks/useMusicBrainzSearch';
import MbResultsList from '@/components/common/MbResultsList';
import AddressAutocomplete from '@/components/common/AddressAutocomplete';
import HelperBox from '@/components/admin/HelperBox';
import {
  getDefaultEventDate,
  formatLocalDate,
  isFourthWednesday,
} from '@/utils/wednesdays';
import type { Event, RsvpApprovalMode, VenueRevealPolicy } from '@/types';

export interface EventFormProps {
  mode: 'create' | 'edit';
  initial?: Event;
  idToken?: string | null; // deprecated — uses useIdToken() internally
  onSaved?: (event: Event) => void;
}

type RevealMode =
  | 'always'
  | 'days_before_event'
  | 'days_after_creation'
  | 'after_n_previous_events'
  | 'correlated_or'
  | 'correlated_and';

type RevealNumberedMode = 'days_before_event' | 'days_after_creation' | 'after_n_previous_events';

interface RevealFormState {
  mode: RevealMode;
  number: string;
  subMode: RevealNumberedMode;
}

function buildRevealPolicy(state: RevealFormState): VenueRevealPolicy {
  const n = Math.max(0, Math.floor(Number(state.number) || 0));
  switch (state.mode) {
    case 'always':
      return { mode: 'always' };
    case 'days_before_event':
      return { mode: 'days_before_event', days: n };
    case 'days_after_creation':
      return { mode: 'days_after_creation', days: n };
    case 'after_n_previous_events':
      return { mode: 'after_n_previous_events', count: n };
    case 'correlated_or':
    case 'correlated_and': {
      const sub = buildSubPolicy(state.subMode, n);
      return {
        mode: 'correlated',
        operator: state.mode === 'correlated_or' ? 'or' : 'and',
        policies: [sub],
      };
    }
  }
}

function buildSubPolicy(mode: RevealNumberedMode, n: number): VenueRevealPolicy {
  switch (mode) {
    case 'days_before_event':
      return { mode: 'days_before_event', days: n };
    case 'days_after_creation':
      return { mode: 'days_after_creation', days: n };
    case 'after_n_previous_events':
      return { mode: 'after_n_previous_events', count: n };
  }
}

function initialRevealState(initial?: Event): RevealFormState {
  const policy = initial?.venueRevealPolicy;
  if (policy) {
    if (policy.mode === 'always') {
      return { mode: 'always', number: '7', subMode: 'days_before_event' };
    }
    if (policy.mode === 'days_before_event') {
      return { mode: 'days_before_event', number: String(policy.days), subMode: 'days_before_event' };
    }
    if (policy.mode === 'days_after_creation') {
      return { mode: 'days_after_creation', number: String(policy.days), subMode: 'days_before_event' };
    }
    if (policy.mode === 'after_n_previous_events') {
      return { mode: 'after_n_previous_events', number: String(policy.count), subMode: 'days_before_event' };
    }
    if (policy.mode === 'correlated') {
      const op: RevealMode = policy.operator === 'or' ? 'correlated_or' : 'correlated_and';
      const sub = policy.policies[0];
      if (sub && sub.mode !== 'always' && sub.mode !== 'correlated') {
        const n =
          sub.mode === 'days_before_event'
            ? String(sub.days)
            : sub.mode === 'days_after_creation'
              ? String(sub.days)
              : String(sub.count);
        const sm: RevealNumberedMode =
          sub.mode === 'days_before_event'
            ? 'days_before_event'
            : sub.mode === 'days_after_creation'
              ? 'days_after_creation'
              : 'after_n_previous_events';
        return { mode: op, number: n, subMode: sm };
      }
      return { mode: op, number: '7', subMode: 'days_before_event' };
    }
  }
  if (initial?.venueRevealDaysBefore != null) {
    return {
      mode: 'days_before_event',
      number: String(initial.venueRevealDaysBefore),
      subMode: 'days_before_event',
    };
  }
  return { mode: 'days_before_event', number: '7', subMode: 'days_before_event' };
}

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange';

const WEEKDAY_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

interface ZineDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
}

const ZineDatePicker: React.FC<ZineDatePickerProps> = ({ value, onChange }) => {
  const parsed = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const leading = first.getDay();
    const out: (Date | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(viewYear, viewMonth, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewYear, viewMonth]);

  const selectedKey = value;
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <div className="border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark p-2 font-body text-zine-burntOrange dark:text-zine-cream">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="mês anterior"
          className="px-2 py-1 font-bold hover:text-zine-burntYellow"
        >
          ◀
        </button>
        <span className="font-display text-sm lowercase">{monthLabel}</span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="próximo mês"
          className="px-2 py-1 font-bold hover:text-zine-burntYellow"
        >
          ▶
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs opacity-70 mb-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = formatLocalDate(d);
          const isSelected = key === selectedKey;
          const isFourthWed = isFourthWednesday(d);
          const base =
            'text-center text-sm py-1 border-2 cursor-pointer transition-colors';
          const tone = isSelected
            ? 'bg-zine-burntOrange text-zine-cream border-zine-burntOrange'
            : isFourthWed
              ? 'bg-zine-burntYellow/30 border-zine-burntOrange hover:bg-zine-burntYellow/60'
              : 'border-transparent hover:bg-zine-burntYellow/20';
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(key)}
              aria-label={key}
              aria-pressed={isSelected}
              className={`${base} ${tone}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const EventForm: React.FC<EventFormProps> = ({
  mode,
  initial,
  onSaved,
}) => {
  const idToken = useIdToken();
  const isCreate = mode === 'create';
  const defaultDate = useMemo(
    () => (isCreate ? formatLocalDate(getDefaultEventDate()) : ''),
    [isCreate],
  );
  const [mbAlbumId, setMbAlbumId] = useState(initial?.mbAlbumId ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(initial?.startTime ?? (isCreate ? '19:00' : ''));
  const [endTime, setEndTime] = useState(initial?.endTime ?? (isCreate ? '23:00' : ''));
  const [location, setLocation] = useState(initial?.location ?? '');
  const [revealState, setRevealState] = useState<RevealFormState>(() => initialRevealState(initial));
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
      const parsedReveal = buildRevealPolicy(revealState);
      const payload = {
        mbAlbumId, title, date, startTime, endTime,
        location: location || null,
        venueRevealPolicy: parsedReveal,
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

        <div className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
          <label htmlFor="event-date-hidden">Data</label>
          <input
            id="event-date-hidden"
            type="hidden"
            aria-label="date"
            value={date}
            readOnly
          />
          <ZineDatePicker value={date} onChange={setDate} />
          <span className="text-xs opacity-70 italic">4ªs quartas em destaque</span>
        </div>

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
          <AddressAutocomplete
            id="event-location"
            ariaLabel="location"
            value={location}
            onChange={setLocation}
            placeholder="ex: Quartinho BH — Rua Exemplo, 123"
            className={`w-full ${inputClass}`}
          />
        </label>

        <fieldset className="flex flex-col gap-2 border-2 border-dashed border-zine-burntYellow p-3">
          <legend className="font-body font-bold text-zine-burntOrange dark:text-zine-cream px-1">
            Estratégia de revelação do local
          </legend>
          <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
            <span>Modo</span>
            <select
              aria-label="venue-reveal-mode"
              value={revealState.mode}
              onChange={(e) => setRevealState((s) => ({ ...s, mode: e.target.value as RevealMode }))}
              className={inputClass}
            >
              <option value="always">Sempre público</option>
              <option value="days_before_event">N dias antes do evento</option>
              <option value="days_after_creation">N dias após criação</option>
              <option value="after_n_previous_events">Após N eventos anteriores</option>
              <option value="correlated_or">Qualquer das condições a seguir (OR)</option>
              <option value="correlated_and">Todas as condições a seguir (AND)</option>
            </select>
          </label>

          {revealState.mode !== 'always' && revealState.mode !== 'correlated_or' && revealState.mode !== 'correlated_and' && (
            <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
              <span>
                {revealState.mode === 'days_before_event'
                  ? 'Dias antes do evento'
                  : revealState.mode === 'days_after_creation'
                    ? 'Dias após criação'
                    : 'Quantidade de eventos anteriores'}
              </span>
              <input
                type="number"
                min={0}
                aria-label="venue-reveal-number"
                value={revealState.number}
                onChange={(e) => setRevealState((s) => ({ ...s, number: e.target.value }))}
                className={inputClass}
              />
            </label>
          )}

          {(revealState.mode === 'correlated_or' || revealState.mode === 'correlated_and') && (
            <>
              <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
                <span>Tipo da condição</span>
                <select
                  aria-label="venue-reveal-sub-mode"
                  value={revealState.subMode}
                  onChange={(e) => setRevealState((s) => ({ ...s, subMode: e.target.value as RevealNumberedMode }))}
                  className={inputClass}
                >
                  <option value="days_before_event">N dias antes do evento</option>
                  <option value="days_after_creation">N dias após criação</option>
                  <option value="after_n_previous_events">Após N eventos anteriores</option>
                </select>
              </label>
              <label className="font-body text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
                <span>Valor da condição</span>
                <input
                  type="number"
                  min={0}
                  aria-label="venue-reveal-sub-number"
                  value={revealState.number}
                  onChange={(e) => setRevealState((s) => ({ ...s, number: e.target.value }))}
                  className={inputClass}
                />
              </label>
            </>
          )}
        </fieldset>

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
