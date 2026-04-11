import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { auth } from '@/services/firebase';

export interface GuestUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  displayName: string;
}

export const GuestUpsellModal: React.FC<GuestUpsellModalProps> = ({
  isOpen,
  onClose,
  email,
  displayName: _displayName,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  function handleClose() {
    setPassword('');
    setConfirm('');
    setError(null);
    setBusy(false);
    setCreated(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('senha precisa ter no mínimo 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('as senhas não batem');
      return;
    }

    setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setCreated(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('[GuestUpsellModal] createUser failed', err);
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/email-already-in-use') {
        setError('esse email já tem conta — tenta fazer login');
      } else {
        setError('não foi possível criar agora, tenta de novo');
      }
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="conta criada!">
        <p role="status" className="font-body text-zine-burntOrange">
          prontinho — agora seu rsvp fica salvo na sua conta.
        </p>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="salva pra próxima?">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="font-body text-sm text-zine-burntOrange">
          você está na lista! quer salvar pra próxima? cria uma conta rapinha —
          ou fecha essa janela que já tá tudo certo.
        </p>
        <input
          type="email"
          value={email}
          disabled
          aria-label="email"
          className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream/50 dark:bg-zine-surface-dark/50 text-zine-burntOrange/60 dark:text-zine-cream/60"
        />
        <input
          type="password"
          placeholder="senha (mínimo 6 caracteres)"
          aria-label="senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
        />
        <input
          type="password"
          placeholder="confirmar senha"
          aria-label="confirmar senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
        />
        {error && (
          <p role="alert" className="font-body text-sm text-zine-burntOrange">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'criando…' : 'criar conta'}
        </Button>
        <button
          type="button"
          onClick={handleClose}
          className="font-body text-sm font-bold text-zine-burntOrange underline text-center"
        >
          fechar — fica pra próxima
        </button>
      </form>
    </Modal>
  );
};

export default GuestUpsellModal;
