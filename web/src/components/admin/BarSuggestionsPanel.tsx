import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ZineFrame from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import SuggestionStatusTabs from '@/components/bares/SuggestionStatusTabs';
import BarCard from '@/components/bares/BarCard';
import { useBarSuggestions } from '@/hooks/useBarSuggestions';
import {
  updateBarSuggestionStatus,
  deleteBarSuggestion,
} from '@/services/api';
import type { SuggestionStatus } from '@/types';

export interface BarSuggestionsPanelProps {
  idToken: string;
}

export const BarSuggestionsPanel: React.FC<BarSuggestionsPanelProps> = ({ idToken }) => {
  const navigate = useNavigate();
  const { bars, loading, error, refresh } = useBarSuggestions();
  const [activeStatus, setActiveStatus] = useState<SuggestionStatus>('suggested');
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
      setActionError(err instanceof Error ? err.message : 'erro ao apagar local');
    }
  }

  return (
    <ZineFrame bg="cream">
      <h2 className="font-display text-xl text-zine-burntOrange mb-2">Locais sugeridos</h2>
      <p className="font-body text-xs text-zine-burntOrange/70 mb-3 italic">
        ❤️/💀 são votos do público. as abas abaixo são a sua curadoria — você pode mover locais entre elas independente dos votos.
      </p>

      <div className="mb-4">
        <Button
          type="button"
          onClick={() => navigate('/novo-local')}
          className="min-h-[44px]"
        >
          indicar local
        </Button>
      </div>

      <div className="mb-3">
        <SuggestionStatusTabs
          activeStatus={activeStatus}
          onChange={setActiveStatus}
          counts={counts}
        />
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
          className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow mb-2"
        >
          {error}
        </p>
      )}
      {actionError && (
        <p
          role="alert"
          aria-live="assertive"
          className="font-body text-xs text-zine-burntOrange font-bold dark:text-zine-burntYellow mb-2"
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
        {!loading && filteredBars.length === 0 && (
          <p className="font-body italic text-zine-burntOrange/70">
            nenhum local nessa aba.
          </p>
        )}
      </div>
    </ZineFrame>
  );
};

export default BarSuggestionsPanel;
