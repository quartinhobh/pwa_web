import React, { useState } from 'react';
import { submitRsvpGuest } from '@/services/api';
import Modal from '@/components/common/Modal';

export interface RsvpFormProps {
  eventId: string;
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  useModal?: boolean;
  eventLocation?: string;
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

export const RsvpForm: React.FC<RsvpFormProps> = ({ eventId, isOpen = false, onClose = () => {}, onSuccess, useModal = false, eventLocation }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  function handleClose() {
    setDisplayName('');
    setEmail('');
    setInstagram('');
    setPlusOne(false);
    setPlusOneName('');
    setError(null);
    setSuccess(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailTrimmed = email.trim();
    const instagramTrimmed = instagram.trim().replace(/^@/, '');
    const displayNameTrimmed = displayName.trim();

    // Validate: name and email required
    if (!displayNameTrimmed) {
      setError('preencha seu nome');
      return;
    }
    if (!emailTrimmed) {
      setError('preencha seu email');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await submitRsvpGuest(eventId, {
        email: emailTrimmed,
        instagram: instagramTrimmed || undefined,
        displayName: displayNameTrimmed,
        plusOne,
        plusOneName: plusOne ? plusOneName.trim() || undefined : undefined,
      });
      const status = res.entry.status;
      if (status === 'cancelled' || status === 'rejected') {
        setError('não foi possível confirmar — tenta de novo');
        return;
      }
      setSuccess({ status, entryKey: res.entryKey });
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
      <div className="text-center py-4">
        <p className="font-display text-xl text-zine-burntOrange mb-2">
          {successText(success.status)}
        </p>
        <p className="font-body text-sm text-zine-burntOrange/70 mb-4">
          te mandamos um email com os detalhes
        </p>
        {eventLocation && (
          <div className="font-body text-sm text-zine-burntOrange">
            <p className="font-bold mb-1">local do evento:</p>
            <p className="italic">{eventLocation}</p>
          </div>
        )}
      </div>
    );

    return useModal ? (
      <Modal isOpen={isOpen} onClose={handleClose}>
        <div className="-m-4 -mb-4">{successContent}</div>
      </Modal>
    ) : (
      successContent
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
      <div>
        <input
          type="email"
          placeholder="seu email"
          aria-label="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange w-full"
        />
        <p className="font-body text-xs text-zine-burntOrange/70 italic mt-1">
          vamos te enviar o local por e-mail
        </p>
      </div>
      <input
        type="text"
        placeholder="seu instagram (opcional)"
        aria-label="instagram"
        value={instagram}
        onChange={(e) => setInstagram(e.target.value)}
        maxLength={30}
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

  return useModal ? (
    <Modal isOpen={isOpen} onClose={handleClose} title="confirma sua presença">
      {formContent}
    </Modal>
  ) : isOpen ? (
    <div className="flex flex-col gap-3 bg-transparent p-4">
      {formContent}
    </div>
  ) : null;
};

export default RsvpForm;
