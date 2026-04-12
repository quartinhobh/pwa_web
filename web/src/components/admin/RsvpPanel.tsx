import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { read, utils, writeFile } from 'xlsx';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import HelperBox from '@/components/admin/HelperBox';
import {
  fetchAdminRsvpList,
  approveRejectRsvp,
  exportRsvpCsv,
  exportRsvpJson,
  importRsvp,
  adminCancelRsvp,
  moveRsvpToWaitlist,
  fetchEvents,
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

type RawImportRow = Record<string, unknown> & {
  displayName?: unknown;
  nome?: unknown;
  email?: unknown;
  EMAIL?: unknown;
  Email?: unknown;
  NAME?: unknown;
  Nome?: unknown;
};

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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Array<{ displayName: string; email: string }> | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
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
  }, [eventId, idToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(entryKey: string, status: 'confirmed' | 'rejected'): Promise<void> {
    setActionBusy(entryKey + status);
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) => (e.entryKey === entryKey ? { ...e, status } : e))
    );
    try {
      await approveRejectRsvp(eventId, entryKey, status, idToken);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar');
      await load();
    } finally {
      setActionBusy(null);
    }
  }

  async function handleRemove(entryKey: string): Promise<void> {
    if (!window.confirm('tem certeza?')) return;
    setActionBusy(entryKey + 'remove');
    // Optimistic update
    const removed = entries.find((e) => e.entryKey === entryKey);
    setEntries((prev) => prev.filter((e) => e.entryKey !== entryKey));
    try {
      await adminCancelRsvp(idToken, eventId, entryKey);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover');
      if (removed) {
        setEntries((prev) => [...prev, removed]);
      }
    } finally {
      setActionBusy(null);
    }
  }

  async function handleMoveToWaitlist(entryKey: string): Promise<void> {
    if (!window.confirm('tem certeza?')) return;
    setActionBusy(entryKey + 'waitlist');
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) => (e.entryKey === entryKey ? { ...e, status: 'waitlisted' } : e))
    );
    try {
      await moveRsvpToWaitlist(idToken, eventId, entryKey);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao mover');
      await load();
    } finally {
      setActionBusy(null);
    }
  }

  async function handleExportCsv(): Promise<void> {
    try {
      const csv = await exportRsvpCsv(eventId, idToken);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsvp-${eventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao exportar');
    }
  }

  async function handleExportExcel(): Promise<void> {
    try {
      const data = visible.map((e) => ({
        nome: e.displayName,
        email: e.email,
        status: e.status,
        origem: e.authMode === 'firebase' ? 'conta' : 'convidado',
        mais_um: e.plusOne ? 'sim' : 'não',
        acompanhante: e.plusOneName ?? '',
        data_rsvp: new Date(e.createdAt).toLocaleDateString('pt-BR'),
      }));
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'RSVPs');
      writeFile(wb, `rsvp-${eventId}.xlsx`);
      setShowExportMenu(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao exportar Excel');
    }
  }

  async function handleExportJson(): Promise<void> {
    try {
      const json = await exportRsvpJson(visible);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rsvp-${eventId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao exportar JSON');
    }
  }

  async function generatePdf(useTestData: boolean = false): Promise<void> {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const eventsRes = await fetchEvents();
      const event = (eventsRes ?? []).find((e) => e.id === eventId);

      if (!event) {
        alert('Evento não encontrado');
        return;
      }

      let confirmed = entries.filter((e) => e.status === 'confirmed');

      // Dados de teste: 30 pessoas
      if (useTestData) {
        const testNames = [
          'Arthur Abeilice', 'Roberto Silva', 'Teste User', 'João Santos', 'Maria Oliveira',
          'Lucas Costa', 'Ana Paula', 'Felipe Martins', 'Beatriz Lima', 'Carlos Dias',
          'Daniela Rocha', 'Eduardo Alves', 'Fernanda Gomes', 'Gabriel Santos', 'Helena Ferreira',
          'Igor Mendes', 'Juliana Ribeiro', 'Kevin Silva', 'Larissa Costa', 'Mateus Oliveira',
          'Natalia Santos', 'Otavio Lima', 'Patricia Dias', 'Quentin Martins', 'Raquel Silva',
          'Samuel Costa', 'Tatiana Alves', 'Ulisses Gomes', 'Vanessa Ferreira', 'Wagner Mendes'
        ];
        const plusOneNames = ['Sofia Mendes', 'Camila Rocha', 'Isabela Costa', 'Mariana Silva', 'Fernanda Dias', 'Beatrice Santos'];
        const now = Date.now();
        confirmed = testNames.map((name, idx): AdminRsvpEntry => ({
          entryKey: `test-${idx}`,
          userId: `test-user-${idx}`,
          avatarUrl: null,
          authMode: 'guest',
          displayName: name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@test.com`,
          status: 'confirmed',
          plusOne: idx % 5 === 0,
          plusOneName: idx % 5 === 0 ? plusOneNames[idx % plusOneNames.length] : null,
          createdAt: now,
          updatedAt: now,
        }));
      }

      // Calcula total de lugares (contando +1)
      const totalLugares = confirmed.reduce((sum, entry) => sum + (entry.plusOne ? 2 : 1), 0);

      // Cria elemento HTML com dados
      const element = document.createElement('div');
      element.innerHTML = `
        <div style="font-family: 'Bitter', Georgia, serif; padding: 16px 20px;">
          <h1 style="font-family: 'Alfa Slab One', serif; font-size: 24px; margin: 0 0 2px 0; color: #333; text-align: center;">
            ${event.title}
          </h1>
          <p style="font-size: 11px; color: #666; margin: 0 0 12px 0; text-align: center; border-bottom: 1px solid #999; padding-bottom: 6px;">
            ${event.date} · ${event.location ?? 'Local não informado'} | Confirmados: ${confirmed.length} pessoas | Lugares: ${totalLugares}
          </p>
          <div>
            ${confirmed.map((entry, idx) => `
              <div>
                <div style="margin-bottom: 2px; padding-bottom: 2px; border-bottom: 1px solid #ddd; display: flex; gap: 20px; align-items: baseline;">
                  <div style="min-width: 20px; font-size: 11px; color: #999; flex-shrink: 0;">
                    ${idx + 1}.
                  </div>
                  <div style="font-size: 11px; color: #333; font-weight: 500; flex: 1;">
                    ${entry.displayName}
                  </div>
                  <div style="color: #666; font-size: 10px; flex: 1.5; text-align: right;">
                    ${entry.email}
                  </div>
                </div>
                ${entry.plusOne ? `
                  <div style="margin-bottom: 6px; padding-left: 24px; padding-bottom: 4px; border-bottom: 1px solid #eee; display: flex; gap: 20px; align-items: baseline; opacity: 0.8;">
                    <div style="font-size: 11px; color: #999; flex-shrink: 0;">
                      ⤷
                    </div>
                    <div style="font-size: 10px; color: #555; font-style: italic; flex: 1;">
                      ${entry.plusOneName || 'acompanhante'}
                    </div>
                    <div style="color: #999; font-size: 10px; flex: 1.5; text-align: right;">
                      —
                    </div>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
          <div style="text-align: center; font-size: 9px; color: #999; border-top: 1px solid #999; padding-top: 6px; margin-top: 16px; page-break-before: avoid;">
            ${new Date().toLocaleDateString('pt-BR')} · Quartinho
          </div>
        </div>
      `;

      const options = {
        margin: 10,
        filename: `Presença - ${event.title}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' as const },
      };

      html2pdf().set(options).from(element).save();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao gerar PDF');
    }
  }

  async function handleImportFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      let parsed: RawImportRow[] = [];

      if (file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const data = await file.arrayBuffer();
        const workbook = read(data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]!];
        if (!sheet) throw new Error('Sheet not found');
        parsed = utils.sheet_to_json(sheet) as RawImportRow[];
      } else {
        // CSV: simple RFC-4180 parser (handles quoted fields)
        const lines = text.trim().split('\n');
        const headers = parseCSVLine(lines[0]!);
        parsed = lines.slice(1).map((line) => {
          const cols = parseCSVLine(line);
          return Object.fromEntries(headers.map((h, i) => [h.toLowerCase().trim(), cols[i]?.trim() ?? ''])) as RawImportRow;
        });
      }

      // Normalize to displayName + email
      const preview = parsed
        .filter((r) => ((r.email ?? r.EMAIL ?? r.Email) || '') && (((r.nome ?? r.displayName ?? r.NAME ?? r.Nome) || '')))
        .slice(0, 5)
        .map((r) => ({
          displayName: ((r.displayName ?? r.nome ?? r.NAME ?? r.Nome) || '').toString(),
          email: ((r.email ?? r.EMAIL ?? r.Email) || '').toString(),
        }));

      setImportFile(file);
      setImportPreview(preview);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao ler arquivo');
    }
  }

  async function handleConfirmImport(): Promise<void> {
    if (!importFile || !importPreview) return;
    setImportBusy(true);
    try {
      const text = await importFile.text();
      let parsed: RawImportRow[] = [];

      if (importFile.name.endsWith('.xlsx')) {
        const data = await importFile.arrayBuffer();
        const workbook = read(data);
        const sheet = workbook.Sheets[workbook.SheetNames[0]!];
        if (!sheet) throw new Error('Sheet not found');
        parsed = utils.sheet_to_json(sheet) as RawImportRow[];
      } else {
        const lines = text.trim().split('\n');
        const headers = parseCSVLine(lines[0]!);
        parsed = lines.slice(1).map((line) => {
          const cols = parseCSVLine(line);
          return Object.fromEntries(headers.map((h, i) => [h.toLowerCase().trim(), cols[i]?.trim() ?? ''])) as RawImportRow;
        });
      }

      const entries = parsed
        .filter((r) => ((r.email ?? r.EMAIL ?? r.Email) || '') && (((r.nome ?? r.displayName ?? r.NAME ?? r.Nome) || '')))
        .map((r) => ({
          displayName: ((r.displayName ?? r.nome ?? r.NAME ?? r.Nome) || '').toString(),
          email: ((r.email ?? r.EMAIL ?? r.Email) || '').toString(),
        }));

      const result = await importRsvp(eventId, entries, idToken);
      alert(`Importado: ${result.imported} · Duplicado/Ignorado: ${result.skipped}`);
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao importar');
    } finally {
      setImportBusy(false);
    }
  }

  function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let val = '';
        i++; // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { val += line[i++]; }
        }
        if (line[i] === ',') i++;
        fields.push(val);
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { fields.push(line.slice(i)); break; }
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
    return fields;
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
    // Optimistic update
    const entryKeysToUpdate = new Set(selectedApprovable.map((e) => e.entryKey));
    setEntries((prev) =>
      prev.map((e) => (entryKeysToUpdate.has(e.entryKey) ? { ...e, status: 'confirmed' } : e))
    );
    let ok = 0;
    for (const entry of selectedApprovable) {
      try {
        await approveRejectRsvp(eventId, entry.entryKey, 'confirmed', idToken);
        ok += 1;
      } catch {
        // swallow; we'll surface count at the end
      }
    }
    // If some failed, reload to get accurate state
    if (ok < selectedApprovable.length) {
      await load();
    }
    setBulkBusy(false);
    setSelected(new Set());
    alert(`${ok}/${selectedApprovable.length} aprovados`);
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
        <div className="flex gap-2 relative">
          <Button
            onClick={() => void generatePdf()}
            className="bg-zine-mint hover:bg-zine-mint/80 text-zine-cream border-2 border-zine-mint"
          >
            📥 IMPRIMIR confirmados
          </Button>
          <Button onClick={() => setShowImportModal(true)}>Importar</Button>
          <div className="relative">
            <Button onClick={() => setShowExportMenu(!showExportMenu)}>Exportar ▾</Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-zine-cream border-2 border-zine-burntOrange shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => void handleExportCsv()}
                  className="block w-full text-left px-3 py-2 font-body text-sm text-zine-burntOrange hover:bg-zine-burntYellow/20"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportExcel()}
                  className="block w-full text-left px-3 py-2 font-body text-sm text-zine-burntOrange hover:bg-zine-burntYellow/20 border-t border-zine-burntOrange/20"
                >
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportJson()}
                  className="block w-full text-left px-3 py-2 font-body text-sm text-zine-burntOrange hover:bg-zine-burntYellow/20 border-t border-zine-burntOrange/20"
                >
                  JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {capacity !== null && (
        <div className="w-full h-3 bg-zine-cream dark:bg-zine-surface-dark border-2 border-zine-burntOrange mb-4 overflow-hidden">
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
                ? 'bg-zine-burntYellow dark:bg-zine-burntYellow-bright text-zine-cream dark:text-zine-surface-dark'
                : 'bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream hover:bg-zine-burntYellow/20 dark:hover:bg-zine-burntYellow-bright/20'
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
        className="w-full font-body text-sm px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream placeholder:text-zine-burntOrange/50 dark:placeholder:text-zine-cream/50 mb-4"
      />

      {loading && <p className="font-body italic text-zine-burntOrange/60">carregando…</p>}
      {error && <p role="alert" className="font-body text-zine-burntOrange">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <p className="font-body italic text-zine-burntOrange/70">Nenhum registro.</p>
      )}

      {!loading && !error && visible.length > 0 && (
        <>
          {/* Desktop table (md+) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full font-body text-sm text-zine-burntOrange dark:text-zine-cream border-collapse">
              <thead>
                <tr className="border-b-2 border-zine-burntYellow dark:border-zine-burntYellow-bright">
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
                    className="border-b border-zine-burntOrange/20 dark:border-zine-cream/20 hover:bg-zine-burntYellow/10 dark:hover:bg-zine-burntYellow-bright/20"
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
                    <td className="py-2 pr-3 text-zine-burntOrange/70 dark:text-zine-cream/70">{entry.email ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <span
                        data-testid={`authmode-badge-${entry.userId}`}
                        className={`inline-block px-2 py-0.5 text-xs border font-body ${
                          entry.authMode === 'firebase'
                            ? 'border-zine-burntOrange dark:border-zine-burntOrange-bright bg-zine-burntOrange/20 dark:bg-zine-burntOrange-bright/20 text-zine-burntOrange dark:text-zine-burntOrange-bright'
                            : 'border-zine-mint dark:border-zine-mint-dark bg-zine-mint/30 dark:bg-zine-mint-dark/30 text-zine-burntOrange dark:text-zine-mint'
                        }`}
                      >
                        {entry.authMode === 'firebase' ? 'conta' : 'convidado'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block px-2 py-0.5 text-xs border font-body ${
                        entry.status === 'confirmed'
                          ? 'border-zine-mint dark:border-zine-mint-dark bg-zine-mint/20 dark:bg-zine-mint-dark/30 text-zine-burntOrange dark:text-zine-mint'
                          : entry.status === 'waitlisted'
                            ? 'border-zine-burntYellow dark:border-zine-burntYellow-bright bg-zine-burntYellow/20 dark:bg-zine-burntYellow-bright/20 text-zine-burntOrange dark:text-zine-burntYellow-bright'
                            : entry.status === 'pending_approval'
                              ? 'border-zine-periwinkle dark:border-zine-periwinkle-dark bg-zine-periwinkle/20 dark:bg-zine-periwinkle-dark/30 text-zine-burntOrange dark:text-zine-periwinkle'
                              : 'border-zine-burntOrange/40 dark:border-zine-cream/30 bg-zine-burntOrange/10 dark:bg-zine-cream/10 text-zine-burntOrange dark:text-zine-cream'
                      }`}>
                        {STATUS_LABELS[entry.status]}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {entry.plusOne ? (entry.plusOneName ?? 'sim') : '—'}
                    </td>
                    <td className="py-2 pr-3 text-zine-burntOrange/60 dark:text-zine-cream/60">
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

          {/* Mobile cards (< md) */}
          <div className="md:hidden flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                aria-label="selecionar todos"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
              />
              <span className="font-body text-sm text-zine-burntOrange/70">Selecionar tudo</span>
            </div>
            {visible.map((entry) => (
              <div
                key={entry.entryKey}
                className="border-2 border-zine-burntOrange p-3 bg-zine-cream/50"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2 flex-1">
                    <input
                      type="checkbox"
                      aria-label={`selecionar ${entry.displayName}`}
                      checked={selected.has(entry.entryKey)}
                      onChange={() => toggleOne(entry.entryKey)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-zine-burntOrange truncate">
                        {entry.displayName}
                      </p>
                      <p className="font-body text-xs text-zine-burntOrange/70 truncate">
                        {entry.email ?? '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-2">
                  <span className={`inline-block px-2 py-0.5 text-xs border font-body ${
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
                  <span className={`inline-block px-2 py-0.5 text-xs border font-body ${
                    entry.authMode === 'firebase'
                      ? 'border-zine-burntOrange bg-zine-burntOrange/20 text-zine-burntOrange'
                      : 'border-zine-mint bg-zine-mint/30 text-zine-burntOrange'
                  }`}>
                    {entry.authMode === 'firebase' ? 'conta' : 'convidado'}
                  </span>
                  {entry.plusOne && (
                    <span className="inline-block px-2 py-0.5 text-xs border border-zine-burntOrange/40 font-body text-zine-burntOrange/70">
                      +1: {entry.plusOneName ?? 'sim'}
                    </span>
                  )}
                </div>

                <div className="font-body text-xs text-zine-burntOrange/60 mb-2">
                  {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                </div>

                <div className="flex flex-col gap-1">
                  {entry.status === 'pending_approval' && (
                    <>
                      <Button
                        disabled={!!actionBusy}
                        onClick={() => void handleAction(entry.entryKey, 'confirmed')}
                        className="w-full text-sm py-1"
                      >
                        {actionBusy === entry.entryKey + 'confirmed' ? '…' : 'aprovar'}
                      </Button>
                      <Button
                        disabled={!!actionBusy}
                        onClick={() => void handleAction(entry.entryKey, 'rejected')}
                        className="w-full text-sm py-1"
                      >
                        {actionBusy === entry.entryKey + 'rejected' ? '…' : 'recusar'}
                      </Button>
                    </>
                  )}
                  {entry.status === 'confirmed' && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={!!actionBusy}
                        onClick={() => void handleRemove(entry.entryKey)}
                        className="flex-1 underline text-xs text-zine-burntOrange disabled:opacity-50 font-body py-1"
                      >
                        {actionBusy === entry.entryKey + 'remove' ? '…' : 'remover'}
                      </button>
                      <button
                        type="button"
                        disabled={!!actionBusy}
                        onClick={() => void handleMoveToWaitlist(entry.entryKey)}
                        className="flex-1 underline text-xs text-zine-burntOrange disabled:opacity-50 font-body py-1"
                      >
                        {actionBusy === entry.entryKey + 'waitlist' ? '…' : '→ fila'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-4 right-4 bg-zine-cream border-2 border-zine-burntOrange p-3 shadow-lg font-body text-sm text-zine-burntOrange z-40">
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-zine-cream border-4 border-zine-burntOrange p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-2xl text-zine-burntOrange mb-4">Importar presença</h3>

            {!importPreview ? (
              <div className="flex flex-col gap-4">
                <p className="font-body text-sm text-zine-burntOrange/70">
                  Suporta CSV e Excel (.xlsx). Campos esperados: <strong>nome</strong> (ou displayName) + <strong>email</strong>.
                </p>
                <label className="flex flex-col gap-2">
                  <span className="font-body text-zine-burntOrange">Escolher arquivo</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      if (file) {
                        void handleImportFile(file);
                      }
                    }}
                    className="font-body text-sm px-3 py-2 border-2 border-zine-burntYellow"
                  />
                </label>
                <div className="flex gap-2">
                  <Button onClick={() => setShowImportModal(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="bg-zine-cream/50 border border-zine-burntOrange/30 p-3">
                  <p className="font-body text-xs text-zine-burntOrange/70 mb-2">
                    Primeiras 5 entradas (total: {importFile ? 'carregando…' : '?'})
                  </p>
                  <ul className="space-y-1">
                    {importPreview.map((p, i) => (
                      <li key={i} className="font-body text-xs text-zine-burntOrange">
                        <span className="font-bold">{p.displayName}</span> · {p.email}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={importBusy}
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview(null);
                    }}
                  >
                    Voltar
                  </Button>
                  <Button
                    disabled={importBusy}
                    onClick={() => void handleConfirmImport()}
                  >
                    {importBusy ? 'importando…' : 'confirmar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ZineFrame>
  );
};

export default RsvpPanel;
