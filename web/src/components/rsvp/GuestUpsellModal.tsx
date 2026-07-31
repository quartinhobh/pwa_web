import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { auth } from '@/services/firebase';

export interface GuestUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  email?: string;
  displayName: string;
  instagram?: string;
}

export const GuestUpsellModal: React.FC<GuestUpsellModalProps> = ({
  isOpen,
  onClose,
  email: initialEmail,
  displayName: _displayName,
  instagram: _instagram,
}) => {
  const [email, setEmail] = useState(initialEmail ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  // Sync email state when initialEmail prop changes
  useEffect(() => {
    setEmail(initialEmail ?? '');
  }, [initialEmail]);

  function handleClose() {
    setEmail(initialEmail ?? '');
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

    // Validate email is provided (required if only instagram was provided)
    if (!email.trim()) {
      setError('email é necessário pra criar conta');
      return;
    }

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
      await createUserWithEmailAndPassword(auth, email.trim(), password);
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

  const hasEmail = initialEmail;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="salva pra próxima?">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="font-body text-sm text-zine-burntOrange">
          você está na lista! quer salvar pra próxima? cria uma conta rapinha —
          ou fecha essa janela que já tá tudo certo.
        </p>
        {hasEmail ? (
          <label className="font-body text-sm text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
            <span>Email</span>
            <input
              type="email"
              value={email}
              disabled
              className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream/50 dark:bg-zine-surface-dark/50 text-zine-burntOrange/60 dark:text-zine-cream/60"
            />
          </label>
        ) : (
          <label className="font-body text-sm text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
            <span>Email</span>
            <input
              type="email"
              placeholder="seu email (necessário pra criar conta)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
            />
          </label>
        )}
        <label className="font-body text-sm text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
          <span>Senha</span>
          <input
            type="password"
            placeholder="mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
          />
        </label>
        <label className="font-body text-sm text-zine-burntOrange dark:text-zine-cream flex flex-col gap-1">
          <span>Confirmar senha</span>
          <input
            type="password"
            placeholder="repita a senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
          />
        </label>
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
