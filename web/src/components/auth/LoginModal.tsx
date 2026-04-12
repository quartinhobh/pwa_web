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

type Mode = 'pick' | 'email-login' | 'email-signup' | 'forgot' | 'verify-sent';

/**
 * Maps Firebase auth error codes to user-facing messages.
 * Never leaks raw codes. Login errors stay generic to avoid user enumeration.
 */
export function mapAuthError(code: string, mode: 'signin' | 'signup'): string {
  if (mode === 'signin') {
    return 'email ou senha incorretos';
  }
  if (code === 'auth/weak-password') {
    return 'senha precisa ter pelo menos 8 caracteres';
  }
  if (code === 'auth/invalid-email') {
    return 'email inválido';
  }
  return 'não foi possível criar conta com esses dados';
}

function extractErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  if (err instanceof Error) {
    // Firebase errors sometimes embed the code in the message.
    const match = err.message.match(/auth\/[a-z-]+/);
    if (match) return match[0];
  }
  return '';
}

function hasLetterAndDigit(pw: string): boolean {
  let hasLetter = false;
  let hasDigit = false;
  for (const ch of pw) {
    if (ch >= '0' && ch <= '9') hasDigit = true;
    else if (ch.toLowerCase() !== ch.toUpperCase()) hasLetter = true;
    if (hasLetter && hasDigit) return true;
  }
  return false;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const {
    signInWithGoogle,

    signInWithEmail,
    signUpWithEmail,
  } = useAuth();
  // signInWithApple is exported by useAuth but not wired in the UI yet.

  type WrapMode = 'signin' | 'signup' | 'oauth';

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

  async function wrap(fn: () => Promise<void>, wrapMode: WrapMode) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (wrapMode === 'signup') {
        // Don't close — show verification-sent screen instead.
        setMode('verify-sent');
        setPassword('');
        setBusy(false);
        return;
      }
      handleClose();
    } catch (err) {
      console.error('[LoginModal] auth failed', err);
      const code = extractErrorCode(err);
      const mappingMode: 'signin' | 'signup' = wrapMode === 'signup' ? 'signup' : 'signin';
      setError(mapAuthError(code, mappingMode));
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

  if (mode === 'verify-sent') {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Verifica seu email">
        <div className="flex flex-col gap-3">
          <p role="status" className="font-body text-sm text-zine-burntOrange">
            enviamos um link de verificação pro seu email. confirma lá pra continuar.
          </p>
          <Button type="button" onClick={handleClose}>
            fechar
          </Button>
        </div>
      </Modal>
    );
  }

  if (mode === 'email-login' || mode === 'email-signup') {
    const isSignup = mode === 'email-signup';
    const showWeakHint =
      isSignup && password.length >= 8 && !hasLetterAndDigit(password);
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title={isSignup ? 'Criar conta' : 'Entrar com email'}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isSignup && password.length < 8) {
              setError('senha precisa ter pelo menos 8 caracteres');
              return;
            }
            void wrap(
              () =>
                isSignup
                  ? signUpWithEmail(email, password)
                  : signInWithEmail(email, password),
              isSignup ? 'signup' : 'signin',
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
            minLength={isSignup ? 8 : 6}
            className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
          />
          {showWeakHint && (
            <p className="font-body text-xs text-zine-burntOrange/50">
              dica: mistura letras e números pra uma senha mais forte
            </p>
          )}
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
        <Button onClick={() => void wrap(signInWithGoogle, 'oauth')} disabled={busy}>
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
