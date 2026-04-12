import React, { useEffect, useMemo, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import HelperBox from '@/components/admin/HelperBox';
import {
  fetchAdminRsvpList,
  approveRejectRsvp,
  exportRsvpCsv,
  adminCancelRsvp,
  moveRsvpToWaitlist,
} from '@/services/api';
import type { AdminRsvpEntry, RsvpStatus } from '@/types';

export interface RsvpPanelProps {
  eventId: string;
  idToken: string;
}

type FilterTab = 'all' | RsvpStatus;
type SortDir = 'asc' | 'desc';
type SortKey = 'createdAt' | 'name';

const STATUS_LABELS: Record<RsvpStatus, string> = {
  confirmed: 'Confirmado',
  waitlisted: 'Na fila',
  pending_approval: 'Aguardando',
  cancelled: 'Cancelado',
  rejected: 'Recusado',
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'confirmed', label: 'Confirmados' },
  { key: 'waitlisted', label: 'Na fila' },
  { key: 'pending_approval', label: 'Aguardando' },
  { key: 'cancelled', label: 'Cancelados' },
];

/** Seats used by a confirmed entry (counts +1). */
function seatsOf(entry: AdminRsvpEntry): number {
  return entry.plusOne ? 2 : 1;
}

export const RsvpPanel: React.FC<RsvpPanelProps> = ({ eventId, idToken }) => {
  const [entries, setEntries] = useState<AdminRsvpEntry[]>([]);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminRsvpList(eventId, idToken);
      setEntries(res.entries);
      setCapacity(res.capacity);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleAction(entryKey: string, status: 'confirmed' | 'rejected'): Promise<void> {
    setActionBusy(entryKey + status);
    try {
      await approveRejectRsvp(eventId, entryKey, status, idToken);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRemove(entryKey: string): Promise<void> {
    if (!window.confirm('tem certeza?')) return;
    setActionBusy(entryKey + 'remove');
    try {
      await adminCancelRsvp(idToken, eventId, entryKey);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleMoveToWaitlist(entryKey: string): Promise<void> {
    if (!window.confirm('tem certeza?')) return;
    setActionBusy(entryKey + 'waitlist');
    try {
      await moveRsvpToWaitlist(idToken, eventId, entryKey);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao mover');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleExport(): Promise<void> {
    try {
      const csv = await exportRsvpCsv(eventId, idToken);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsvp-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao exportar');
    }
  }

  // Effective confirmed headcount including +1s.
  const confirmedSeats = useMemo(
    () =>
      entries
        .filter((e) => e.status === 'confirmed')
        .reduce((sum, e) => sum + seatsOf(e), 0),
    [entries],
  );
  const waitlistCount = entries.filter((e) => e.status === 'waitlisted').length;
  const pendingCount = entries.filter((e) => e.status === 'pending_approval').length;

  const progressPct = capacity && capacity > 0
    ? Math.min(100, Math.round((confirmedSeats / capacity) * 100))
    : 0;
  const barColor = progressPct >= 80 ? 'bg-zine-burntOrange' : 'bg-zine-burntYellow';

  const visible = useMemo(() => {
    const tabFiltered = filter === 'all' ? entries : entries.filter((e) => e.status === filter);
    const q = search.trim().toLowerCase();
    const searched = q
      ? tabFiltered.filter(
          (e) =>
            e.displayName.toLowerCase().includes(q) ||
            (e.email ?? '').toLowerCase().includes(q),
        )
      : tabFiltered;
    const sorted = [...searched].sort((a, b) => {
      const cmp =
        sortKey === 'name'
          ? a.displayName.localeCompare(b.displayName, 'pt-BR')
          : a.createdAt - b.createdAt;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [entries, filter, search, sortKey, sortDir]);

  function toggleSortName(): void {
    if (sortKey !== 'name') {
      setSortKey('name');
      setSortDir('asc');
    } else {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    }
  }

  function toggleOne(key: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAllVisible(): void {
    setSelected((prev) => {
      const allKeys = visible.map((e) => e.entryKey);
      const everySelected = allKeys.length > 0 && allKeys.every((k) => prev.has(k));
      if (everySelected) {
        const next = new Set(prev);
        for (const k of allKeys) next.delete(k);
        return next;
      }
      const next = new Set(prev);
      for (const k of allKeys) next.add(k);
      return next;
    });
  }

  const selectedEntries = useMemo(
    () => entries.filter((e) => selected.has(e.entryKey)),
    [entries, selected],
  );
  const selectedApprovable = selectedEntries.filter(
    (e) => e.status === 'pending_approval' || e.status === 'waitlisted',
  );
  const selectedSeats = selectedApprovable.reduce((s, e) => s + seatsOf(e), 0);
  const overCapacity =
    capacity !== null && confirmedSeats + selectedSeats > capacity;

  async function handleBulkApprove(): Promise<void> {
    if (!selectedApprovable.length) return;
    if (overCapacity && !window.confirm('excede capacidade. continuar?')) return;
    setBulkBusy(true);
    let ok = 0;
    for (const entry of selectedApprovable) {
      try {
        await approveRejectRsvp(eventId, entry.entryKey, 'confirmed', idToken);
        ok += 1;
      } catch {
        // swallow; we'll surface count at the end
      }
    }
    setBulkBusy(false);
    alert(`${ok}/${selectedApprovable.length} aprovados`);
    await load();
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((e) => selected.has(e.entryKey));

  return (
    <ZineFrame bg="cream">
      <HelperBox>Lista completa de presença do evento. Filtre por status, aprove ou recuse entradas pendentes, e exporte o CSV para uso externo.</HelperBox>

      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-display text-2xl text-zine-burntOrange">Presença</h2>
          <div className="font-display text-3xl text-zine-burntOrange mt-1" data-testid="rsvp-counter">
            {confirmedSeats}
            {capacity !== null && <span className="opacity-60"> / {capacity}</span>}
            <span className="font-body text-sm opacity-70 ml-2">confirmados</span>
          </div>
          {(waitlistCount > 0 || pendingCount > 0) && (
            <p className="font-body text-sm text-zine-burntOrange/70 mt-1">
              {waitlistCount > 0 && `${waitlistCount} em fila`}
              {waitlistCount > 0 && pendingCount > 0 && ' · '}
              {pendingCount > 0 && `${pendingCount} pendentes`}
            </p>
          )}
        </div>
        <Button onClick={() => void handleExport()}>Exportar CSV</Button>
      </div>

      {capacity !== null && (
        <div className="w-full h-3 bg-zine-cream border-2 border-zine-burntOrange mb-4 overflow-hidden">
          <div
            data-testid="rsvp-progress-bar"
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`font-body text-xs px-3 py-1.5 border-2 border-zine-burntYellow transition-colors ${
              filter === key
                ? 'bg-zine-burntYellow text-zine-cream'
                : 'bg-zine-cream text-zine-burntOrange hover:bg-zine-burntYellow/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="buscar por nome ou email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full font-body text-sm px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream text-zine-burntOrange placeholder:text-zine-burntOrange/50 mb-4"
      />

      {loading && <p className="font-body italic text-zine-burntOrange/60">carregando…</p>}
      {error && <p role="alert" className="font-body text-zine-burntOrange">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <p className="font-body italic text-zine-burntOrange/70">Nenhum registro.</p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm text-zine-burntOrange border-collapse">
            <thead>
              <tr className="border-b-2 border-zine-burntYellow">
                <th className="py-2 pr-3 w-6">
                  <input
                    type="checkbox"
                    aria-label="selecionar todos"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                </th>
                <th className="text-left py-2 pr-3 cursor-pointer select-none" onClick={toggleSortName}>
                  Nome {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-left py-2 pr-3">Email</th>
                <th className="text-left py-2 pr-3">Origem</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">+1</th>
                <th className="text-left py-2 pr-3">Data</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <tr
                  key={entry.entryKey}
                  className="border-b border-zine-burntOrange/20 hover:bg-zine-burntYellow/10"
                >
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      aria-label={`selecionar ${entry.displayName}`}
                      checked={selected.has(entry.entryKey)}
                      onChange={() => toggleOne(entry.entryKey)}
                    />
                  </td>
                  <td className="py-2 pr-3 font-bold">{entry.displayName}</td>
                  <td className="py-2 pr-3 text-zine-burntOrange/70">{entry.email ?? '—'}</td>
                  <td className="py-2 pr-3">
                    <span
                      data-testid={`authmode-badge-${entry.userId}`}
                      className={`inline-block px-2 py-0.5 text-xs border font-body ${
                        entry.authMode === 'firebase'
                          ? 'border-zine-burntOrange bg-zine-burntOrange/20 text-zine-burntOrange'
                          : 'border-zine-mint bg-zine-mint/30 text-zine-burntOrange'
                      }`}
                    >
                      {entry.authMode === 'firebase' ? 'conta' : 'convidado'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block px-2 py-0.5 text-xs border ${
                      entry.status === 'confirmed'
                        ? 'border-zine-mint bg-zine-mint/20'
                        : entry.status === 'waitlisted'
                          ? 'border-zine-burntYellow bg-zine-burntYellow/20'
                          : entry.status === 'pending_approval'
                            ? 'border-zine-periwinkle bg-zine-periwinkle/20'
                            : 'border-zine-burntOrange/40 bg-zine-burntOrange/10'
                    }`}>
                      {STATUS_LABELS[entry.status]}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {entry.plusOne ? (entry.plusOneName ?? 'sim') : '—'}
                  </td>
                  <td className="py-2 pr-3 text-zine-burntOrange/60">
                    {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-2">
                    {entry.status === 'pending_approval' && (
                      <div className="flex gap-1">
                        <Button
                          disabled={!!actionBusy}
                          onClick={() => void handleAction(entry.entryKey, 'confirmed')}
                        >
                          {actionBusy === entry.entryKey + 'confirmed' ? '…' : 'aprovar'}
                        </Button>
                        <Button
                          disabled={!!actionBusy}
                          onClick={() => void handleAction(entry.entryKey, 'rejected')}
                        >
                          {actionBusy === entry.entryKey + 'rejected' ? '…' : 'recusar'}
                        </Button>
                      </div>
                    )}
                    {entry.status === 'confirmed' && (
                      <div className="flex gap-2 text-sm">
                        <button
                          type="button"
                          disabled={!!actionBusy}
                          onClick={() => void handleRemove(entry.entryKey)}
                          className="underline text-zine-burntOrange disabled:opacity-50"
                        >
                          {actionBusy === entry.entryKey + 'remove' ? '…' : 'remover'}
                        </button>
                        <button
                          type="button"
                          disabled={!!actionBusy}
                          onClick={() => void handleMoveToWaitlist(entry.entryKey)}
                          className="underline text-zine-burntOrange disabled:opacity-50"
                        >
                          {actionBusy === entry.entryKey + 'waitlist' ? '…' : '→ fila'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-4 right-4 bg-zine-cream border-2 border-zine-burntOrange p-3 shadow-lg font-body text-sm text-zine-burntOrange">
          <div className="mb-2">
            {selected.size} selecionado{selected.size !== 1 ? 's' : ''}
            {selectedApprovable.length !== selected.size && (
              <span className="opacity-60"> · {selectedApprovable.length} aprovável{selectedApprovable.length !== 1 ? 'eis' : ''}</span>
            )}
          </div>
          {overCapacity && (
            <div className="text-xs text-zine-burntOrange mb-2">
              aviso: excede capacidade ({confirmedSeats + selectedSeats}/{capacity})
            </div>
          )}
          <Button
            disabled={bulkBusy || selectedApprovable.length === 0}
            onClick={() => void handleBulkApprove()}
          >
            {bulkBusy ? '…' : `aprovar ${selectedApprovable.length} selecionado${selectedApprovable.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </ZineFrame>
  );
};

export default RsvpPanel;
