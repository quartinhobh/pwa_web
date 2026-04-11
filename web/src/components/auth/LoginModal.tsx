import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/services/firebase';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'pick' | 'email-login' | 'email-signup' | 'forgot';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const {
    signInWithGoogle,

    signInWithEmail,
    signUpWithEmail,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('pick');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  function reset() {
    setMode('pick');
    setEmail('');
    setPassword('');
    setError(null);
    setBusy(false);
    setForgotSent(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      handleClose();
    } catch (err) {
      setError((err as Error).message ?? 'erro desconhecido');
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: false,
      });
      setForgotSent(true);
      setTimeout(() => {
        setForgotSent(false);
        setMode('email-login');
      }, 3000);
    } catch (err) {
      console.error('[LoginModal] password reset failed', err);
      setError('não foi possível enviar agora, tente de novo');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'forgot') {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Recuperar senha">
        <form onSubmit={handleForgot} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            aria-label="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
          />
          {forgotSent && (
            <p role="status" className="font-body text-sm text-zine-burntOrange">
              se o email existir, um link foi enviado
            </p>
          )}
          {error && !forgotSent && (
            <p role="alert" className="font-body text-sm text-zine-burntOrange">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || forgotSent}>
            {busy ? 'enviando…' : 'enviar link de recuperação'}
          </Button>
          <button
            type="button"
            onClick={() => { setError(null); setForgotSent(false); setMode('email-login'); }}
            className="font-body text-sm text-zine-burntOrange/60 text-center"
          >
            ← voltar
          </button>
        </form>
      </Modal>
    );
  }

  if (mode === 'email-login' || mode === 'email-signup') {
    const isSignup = mode === 'email-signup';
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title={isSignup ? 'Criar conta' : 'Entrar com email'}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void wrap(() =>
              isSignup
                ? signUpWithEmail(email, password)
                : signInWithEmail(email, password),
            );
          }}
          className="flex flex-col gap-3"
        >
          <input
            type="email"
            placeholder="Email"
            aria-label="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
          />
          <input
            type="password"
            placeholder="Senha"
            aria-label="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {busy ? 'entrando…' : isSignup ? 'criar conta' : 'entrar'}
          </Button>
          {!isSignup && (
            <button
              type="button"
              onClick={() => { setError(null); setPassword(''); setMode('forgot'); }}
              className="font-body text-sm text-zine-burntOrange hover:underline text-center"
            >
              esqueceu a senha?
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode(isSignup ? 'email-login' : 'email-signup')}
            className="font-body text-sm text-zine-burntOrange underline text-center"
          >
            {isSignup ? 'já tenho conta' : 'criar conta nova'}
          </button>
          <button
            type="button"
            onClick={() => { setError(null); setMode('pick'); }}
            className="font-body text-sm text-zine-burntOrange/60 text-center"
          >
            ← voltar
          </button>
        </form>
      </Modal>
    );
  }

  // ── Pick method ──
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Entrar no Quartinho">
      <div className="flex flex-col gap-3">
        <Button onClick={() => void wrap(signInWithGoogle)} disabled={busy}>
          Entrar com Google
        </Button>
<Button onClick={() => setMode('email-login')} disabled={busy}>
          Entrar com Email
        </Button>
        {error && (
          <p role="alert" className="font-body text-sm text-zine-burntOrange">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleClose}
          className="font-body text-sm text-zine-burntOrange/60 text-center"
        >
          agora não
        </button>
      </div>
    </Modal>
  );
};

export default LoginModal;
