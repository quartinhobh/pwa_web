import { useState } from 'react';
import type { RsvpConfig, RsvpEntry, RsvpSummary } from '@/types';
import RsvpForm from './RsvpForm';

interface RsvpButtonProps {
  config: RsvpConfig;
  summary: RsvpSummary;
  userEntry: RsvpEntry | null;
  isAuthenticated: boolean;
  onSubmit: (opts?: { plusOne?: boolean; plusOneName?: string }) => Promise<void>;
  onCancel: () => Promise<void>;
  eventId?: string;
  showFormDirectly?: boolean;
  eventLocation?: string;
  isLive?: boolean;
}

type FormState = 'closed' | 'open';

function isWindowOpen(config: RsvpConfig): boolean {
  const now = Date.now();
  if (config.opensAt && now < config.opensAt) return false;
  if (config.closesAt && now > config.closesAt) return false;
  return true;
}

export const RsvpButton: React.FC<RsvpButtonProps> = ({
  config,
  summary,
  userEntry,
  isAuthenticated,
  onSubmit,
  onCancel,
  eventId,
  showFormDirectly = false,
  eventLocation,
  isLive = false,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [showPlusOne, setShowPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>('closed');

  const activeEntry = userEntry && userEntry.status !== 'cancelled' && userEntry.status !== 'rejected'
    ? userEntry
    : null;

  const windowOpen = isWindowOpen(config);
  const isFull = config.capacity !== null && summary.confirmedCount >= config.capacity;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(
        config.plusOneAllowed && showPlusOne
          ? { plusOne: true, plusOneName: plusOneName.trim() || undefined }
          : undefined,
      );
      setShowPlusOne(false);
      setPlusOneName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro';
      if (msg === 'event_full') setError('esgotado!');
      else if (msg === 'rsvp_closed') setError('inscrições fechadas');
      else setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onCancel();
    } catch {
      setError('erro ao cancelar');
    } finally {
      setSubmitting(false);
    }
  };

  // Already RSVP'd — show status + cancel option
  if (activeEntry) {
    const statusLabels: Record<string, string> = {
      confirmed: 'presença confirmada',
      waitlisted: 'na fila de espera',
      pending_approval: 'aguardando aprovação',
    };
    const statusLabel = statusLabels[activeEntry.status] ?? activeEntry.status;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between bg-zine-mint dark:bg-zine-mint-dark border-4 border-zine-cream dark:border-zine-cream/30 px-4 py-3">
          <span className="font-body font-bold text-zine-cream">
            {statusLabel}
            {activeEntry.plusOne && activeEntry.plusOneName && (
              <span className="font-normal text-sm"> (+1: {activeEntry.plusOneName})</span>
            )}
          </span>
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="font-body text-sm text-zine-cream/70 hover:text-zine-cream underline disabled:opacity-50"
          >
            cancelar
          </button>
        </div>
        {error && <p className="font-body text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Not authenticated — guest RSVP form
  if (!isAuthenticated) {
    if (!eventId) {
      return (
        <div className="bg-zine-cream dark:bg-zine-surface-dark border-4 border-zine-burntYellow px-4 py-3 text-center">
          <p className="font-body text-sm text-zine-burntOrange">
            configuração inválida: eventId ausente
          </p>
        </div>
      );
    }
    if (!windowOpen && config.opensAt && Date.now() < config.opensAt) {
      return (
        <div className="bg-zine-cream dark:bg-zine-surface-dark border-4 border-zine-burntYellow px-4 py-3 text-center">
          <p className="font-body text-sm text-zine-burntOrange italic">
            inscrições abrem em {new Date(config.opensAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      );
    }
    if (!windowOpen) {
      return (
        <div className="bg-zine-cream dark:bg-zine-surface-dark border-4 border-zine-burntYellow px-4 py-3 text-center">
          <p className="font-body text-sm text-zine-burntOrange italic">inscrições encerradas</p>
        </div>
      );
    }

    if (showFormDirectly) {
      return (
        <RsvpForm
          eventId={eventId}
          isOpen={true}
          onClose={() => setFormState('closed')}
          onSuccess={() => setFormState('closed')}
          useModal={false}
          eventLocation={eventLocation}
          isLive={isLive}
        />
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={() => setFormState('open')}
          className="w-full font-body font-bold italic text-center bg-zine-burntYellow dark:bg-zine-burntYellow-bright text-zine-cream dark:text-zine-surface-dark px-4 py-3 border-4 border-zine-cream dark:border-zine-cream/30 hover:bg-zine-burntOrange disabled:opacity-50"
        >
          confirmar presença
        </button>
        <RsvpForm
          eventId={eventId}
          isOpen={formState === 'open'}
          onClose={() => setFormState('closed')}
          onSuccess={() => setFormState('closed')}
          eventLocation={eventLocation}
          isLive={isLive}
        />
      </>
    );
  }

  // Window not open yet
  if (!windowOpen && config.opensAt && Date.now() < config.opensAt) {
    return (
      <div className="bg-zine-cream dark:bg-zine-surface-dark border-4 border-zine-burntYellow px-4 py-3 text-center">
        <p className="font-body text-sm text-zine-burntOrange italic">
          inscrições abrem em {new Date(config.opensAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    );
  }

  // Window closed
  if (!windowOpen) {
    return (
      <div className="bg-zine-cream dark:bg-zine-surface-dark border-4 border-zine-burntYellow px-4 py-3 text-center">
        <p className="font-body text-sm text-zine-burntOrange italic">inscrições encerradas</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* +1 toggle */}
      {config.plusOneAllowed && (
        <label className="flex items-center gap-2 font-body text-sm text-zine-burntOrange cursor-pointer">
          <input
            type="checkbox"
            checked={showPlusOne}
            onChange={(e) => setShowPlusOne(e.target.checked)}
            className="accent-zine-burntYellow"
          />
          levar +1
          {showPlusOne && (
            <input
              type="text"
              value={plusOneName}
              onChange={(e) => setPlusOneName(e.target.value)}
              placeholder="nome do acompanhante"
              className="flex-1 ml-1 px-2 py-1 border-2 border-zine-burntOrange/30 bg-transparent text-zine-burntOrange font-body text-sm"
            />
          )}
        </label>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full font-body font-bold italic text-center bg-zine-burntYellow dark:bg-zine-burntYellow-bright text-zine-cream dark:text-zine-surface-dark px-4 py-3 border-4 border-zine-cream dark:border-zine-cream/30 hover:bg-zine-burntOrange disabled:opacity-50"
      >
        {submitting ? 'confirmando...' : isFull ? 'entrar na fila de espera' : 'confirmar presença'}
      </button>

      {error && <p className="font-body text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default RsvpButton;
