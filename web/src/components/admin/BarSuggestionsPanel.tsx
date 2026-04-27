import React, { useMemo, useState } from 'react';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import SuggestionStatusTabs from '@/components/bares/SuggestionStatusTabs';
import BarCard from '@/components/bares/BarCard';
import { useBarSuggestions } from '@/hooks/useBarSuggestions';
import {
  createBarSuggestion,
  updateBarSuggestionStatus,
  deleteBarSuggestion,
} from '@/services/api';
import type { SuggestionStatus } from '@/types';

const inputClass =
  'border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream font-body p-2 focus:outline-none focus:border-zine-burntOrange w-full';

export interface BarSuggestionsPanelProps {
  idToken: string;
}

export const BarSuggestionsPanel: React.FC<BarSuggestionsPanelProps> = ({ idToken }) => {
  const { bars, loading, error, refresh } = useBarSuggestions();
  const [activeStatus, setActiveStatus] = useState<SuggestionStatus>('suggested');
  const [newBarName, setNewBarName] = useState('');
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c = { suggested: 0, liked: 0, disliked: 0 };
    for (const bar of bars) {
      const barWithStatus = bar as typeof bar & { status?: SuggestionStatus };
      const s = barWithStatus.status ?? 'suggested';
      if (s in c) c[s as SuggestionStatus]++;
    }
    return c;
  }, [bars]);

  const filteredBars = useMemo(() => {
    return bars.filter((bar) => {
      const barWithStatus = bar as typeof bar & { status?: SuggestionStatus };
      const s = barWithStatus.status ?? 'suggested';
      return s === activeStatus;
    });
  }, [bars, activeStatus]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBarName.trim()) return;
    setBusy(true);
    setCreateError(null);
    try {
      await createBarSuggestion({ name: newBarName.trim() }, idToken);
      setNewBarName('');
      refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'erro ao adicionar bar');
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveStatus(id: string, status: SuggestionStatus) {
    setActionError(null);
    try {
      await updateBarSuggestionStatus(id, status, idToken);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'erro ao mover status');
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await deleteBarSuggestion(id, idToken);
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'erro ao apagar bar');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ZineFrame bg="cream">
        <h2 className="font-display text-xl text-zine-burntOrange mb-3">Bares sugeridos</h2>
        <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newBarName}
              onChange={(e) => setNewBarName(e.target.value)}
              placeholder="nome do bar"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <Button type="submit" disabled={busy || !newBarName.trim()} className="min-h-[44px]">
              {busy ? 'adicionando...' : 'adicionar bar'}
            </Button>
          </div>
          {createError && (
            <p
              role="alert"
              aria-live="assertive"
              className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow"
            >
              {createError}
            </p>
          )}
        </form>
      </ZineFrame>

      <SuggestionStatusTabs
        activeStatus={activeStatus}
        onChange={setActiveStatus}
        counts={counts}
      />

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
        {filteredBars.map((bar) => (
          <BarCard
            key={bar.id}
            bar={bar}
            idToken={idToken}
            firebaseUid="admin"
            asDetail={false}
            onMoveStatus={(id, status) => void handleMoveStatus(id, status)}
            onDelete={(id) => void handleDelete(id)}
          />
        ))}
      </div>
    </div>
  );
};

export default BarSuggestionsPanel;
