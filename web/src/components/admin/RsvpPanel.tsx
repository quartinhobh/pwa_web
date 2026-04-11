import React, { useEffect, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import HelperBox from '@/components/admin/HelperBox';
import { fetchAdminRsvpList, approveRejectRsvp, exportRsvpCsv } from '@/services/api';
import type { AdminRsvpEntry, RsvpStatus } from '@/types';

export interface RsvpPanelProps {
  eventId: string;
  idToken: string;
}

type FilterTab = 'all' | RsvpStatus;

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

export const RsvpPanel: React.FC<RsvpPanelProps> = ({ eventId, idToken }) => {
  const [entries, setEntries] = useState<AdminRsvpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminRsvpList(eventId, idToken);
      setEntries(res.entries);
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

  async function handleAction(userId: string, status: 'confirmed' | 'rejected'): Promise<void> {
    setActionBusy(userId + status);
    try {
      await approveRejectRsvp(eventId, userId, status, idToken);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar');
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

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter);

  const confirmedCount = entries.filter((e) => e.status === 'confirmed').length;
  const waitlistCount = entries.filter((e) => e.status === 'waitlisted').length;

  return (
    <ZineFrame bg="cream">
      <HelperBox>Lista completa de presença do evento. Filtre por status, aprove ou recuse entradas pendentes, e exporte o CSV para uso externo.</HelperBox>

      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="font-display text-2xl text-zine-burntOrange">Presença</h2>
          <p className="font-body text-sm text-zine-burntOrange/70">
            {confirmedCount} confirmado{confirmedCount !== 1 ? 's' : ''}
            {waitlistCount > 0 && ` · ${waitlistCount} na fila`}
          </p>
        </div>
        <Button onClick={() => void handleExport()}>Exportar CSV</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
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

      {loading && <p className="font-body italic text-zine-burntOrange/60">carregando…</p>}
      {error && <p role="alert" className="font-body text-zine-burntOrange">{error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="font-body italic text-zine-burntOrange/70">Nenhum registro.</p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm text-zine-burntOrange border-collapse">
            <thead>
              <tr className="border-b-2 border-zine-burntYellow">
                <th className="text-left py-2 pr-3">Nome</th>
                <th className="text-left py-2 pr-3">Email</th>
                <th className="text-left py-2 pr-3">Origem</th>
                <th className="text-left py-2 pr-3">Status</th>
                <th className="text-left py-2 pr-3">+1</th>
                <th className="text-left py-2 pr-3">Data</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.userId}
                  className="border-b border-zine-burntOrange/20 hover:bg-zine-burntYellow/10"
                >
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
                          onClick={() => void handleAction(entry.userId, 'confirmed')}
                        >
                          {actionBusy === entry.userId + 'confirmed' ? '…' : 'aprovar'}
                        </Button>
                        <Button
                          disabled={!!actionBusy}
                          onClick={() => void handleAction(entry.userId, 'rejected')}
                        >
                          {actionBusy === entry.userId + 'rejected' ? '…' : 'recusar'}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ZineFrame>
  );
};

export default RsvpPanel;
