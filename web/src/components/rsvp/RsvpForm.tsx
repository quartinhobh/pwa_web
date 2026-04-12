import React, { useState } from 'react';
import { submitRsvpGuest } from '@/services/api';
import Modal from '@/components/common/Modal';
import GuestUpsellModal from './GuestUpsellModal';

export interface RsvpFormProps {
  eventId: string;
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  useModal?: boolean;
}

type SuccessState = {
  status: 'confirmed' | 'waitlisted' | 'pending_approval';
  entryKey: string;
};

const errorMessages: Record<string, string> = {
  email_already_rsvped: 'esse email já confirmou presença',
  already_rsvped: 'você já confirmou presença',
  event_full: 'evento lotou — você foi pra fila',
  rsvp_closed: 'inscrições encerradas',
  rsvp_disabled: 'rsvp desabilitado pra esse evento',
  event_not_found: 'evento não encontrado',
};

function mapError(msg: string): string {
  return errorMessages[msg] ?? 'não foi possível confirmar — tenta de novo';
}

function successText(status: SuccessState['status']): string {
  if (status === 'confirmed') return 'você está na lista!';
  if (status === 'waitlisted') return 'tá na fila — avisamos se abrir vaga';
  return 'inscrição recebida — aguardando aprovação';
}

export const RsvpForm: React.FC<RsvpFormProps> = ({ eventId, isOpen = false, onClose = () => {}, onSuccess, useModal = false }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  function handleClose() {
    setDisplayName('');
    setEmail('');
    setPlusOne(false);
    setPlusOneName('');
    setError(null);
    setSuccess(null);
    setShowUpsell(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await submitRsvpGuest(eventId, {
        email: email.trim(),
        displayName: displayName.trim(),
        plusOne,
        plusOneName: plusOne ? plusOneName.trim() || undefined : undefined,
      });
      const status = res.entry.status;
      if (status === 'cancelled' || status === 'rejected') {
        setError('não foi possível confirmar — tenta de novo');
        return;
      }
      setSuccess({ status, entryKey: res.entryKey });
      setShowUpsell(true);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error('[RsvpForm] submit failed', err);
      setError(mapError(msg));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    const successContent = (
      <div className="bg-zine-mint dark:bg-zine-mint-dark border-4 border-zine-cream dark:border-zine-cream/30 px-4 py-4 text-center">
        <p className="font-display text-xl text-zine-cream mb-1">
          {successText(success.status)}
        </p>
        <p className="font-body text-sm text-zine-cream/80">
          te mandamos um email com os detalhes
        </p>
      </div>
    );

    return (
      <>
        {useModal ? (
          <Modal isOpen={isOpen} onClose={handleClose}>
            <div className="-m-4 -mb-4">{successContent}</div>
          </Modal>
        ) : (
          successContent
        )}
        <GuestUpsellModal
          isOpen={showUpsell}
          onClose={() => setShowUpsell(false)}
          email={email.trim()}
          displayName={displayName.trim()}
        />
      </>
    );
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="font-display text-lg text-zine-burntOrange">
        confirma sua presença
      </p>
      <input
        type="text"
        placeholder="seu nome"
        aria-label="nome"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
        className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
      />
      <input
        type="email"
        placeholder="seu email"
        aria-label="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
      />
      <label className="flex items-center gap-2 font-body text-sm text-zine-burntOrange cursor-pointer">
        <input
          type="checkbox"
          checked={plusOne}
          onChange={(e) => setPlusOne(e.target.checked)}
          aria-label="levar +1"
          className="accent-zine-burntYellow"
        />
        levar +1
      </label>
      {plusOne && (
        <input
          type="text"
          placeholder="nome do acompanhante (opcional)"
          aria-label="nome do acompanhante"
          value={plusOneName}
          onChange={(e) => setPlusOneName(e.target.value)}
          className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
        />
      )}
      {error && (
        <p role="alert" className="font-body text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full font-body font-bold italic text-center bg-zine-burntOrange text-zine-cream px-4 py-3 border-4 border-zine-cream dark:border-zine-cream/30 hover:bg-zine-burntYellow disabled:opacity-50"
      >
        {loading ? 'confirmando...' : 'confirmar presença'}
      </button>
    </form>
  );

  return (
    <>
      {useModal ? (
        <Modal isOpen={isOpen} onClose={handleClose} title="confirma sua presença">
          {formContent}
        </Modal>
      ) : isOpen ? (
        <div className="flex flex-col gap-3 bg-zine-cream dark:bg-zine-surface-dark border-4 border-zine-burntYellow p-4">
          {formContent}
        </div>
      ) : null}
      <GuestUpsellModal
        isOpen={showUpsell}
        onClose={() => setShowUpsell(false)}
        email={email.trim()}
        displayName={displayName.trim()}
      />
    </>
  );
};

export default RsvpForm;
