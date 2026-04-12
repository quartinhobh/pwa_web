import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { auth } from '@/services/firebase';
import { ZineFrame } from '@/components/common/ZineFrame';
import Button from '@/components/common/Button';
import { LoadingState } from '@/components/common/LoadingState';

type Status = 'verifying' | 'ready' | 'invalid' | 'submitting' | 'done';

export const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = params.get('oobCode');
  const mode = params.get('mode');

  const [status, setStatus] = useState<Status>('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!oobCode || mode !== 'resetPassword') {
      setStatus('invalid');
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(() => setStatus('ready'))
      .catch((err) => {
        console.error('[ResetPassword] verify failed', err);
        setStatus('invalid');
      });
  }, [oobCode, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('senha precisa ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('as senhas não batem');
      return;
    }
    if (!oobCode) return;
    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('done');
      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      console.error('[ResetPassword] confirm failed', err);
      setError('não foi possível redefinir, tente pedir outro link');
      setStatus('ready');
    }
  }

  if (status === 'verifying') return <LoadingState />;

  if (status === 'invalid') {
    return (
      <main className="flex flex-col items-center gap-4 max-w-[640px] mx-auto">
        <ZineFrame bg="cream">
          <h2 className="font-display text-2xl text-zine-burntOrange mb-2">
            link expirado
          </h2>
          <p className="font-body text-sm text-zine-burntOrange">
            esse link de recuperação não é mais válido. peça outro na tela de login.
          </p>
        </ZineFrame>
      </main>
    );
  }

  if (status === 'done') {
    return (
      <main className="flex flex-col items-center gap-4 max-w-[640px] mx-auto">
        <ZineFrame bg="mint">
          <h2 className="font-display text-2xl text-zine-cream mb-2">
            senha redefinida
          </h2>
          <p className="font-body text-sm text-zine-cream">
            redirecionando…
          </p>
        </ZineFrame>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center gap-4 max-w-[640px] mx-auto">
      <ZineFrame bg="cream">
        <h2 className="font-display text-2xl text-zine-burntOrange mb-3">
          nova senha
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Nova senha"
            aria-label="nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
          />
          <input
            type="password"
            placeholder="Confirmar senha"
            aria-label="confirmar senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className="font-body px-3 py-2 border-4 border-zine-burntYellow bg-zine-cream dark:bg-zine-surface-dark text-zine-burntOrange dark:text-zine-cream focus:outline-none focus:border-zine-burntOrange"
          />
          {password.length >= 8 &&
            !(/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) && (
              <p className="font-body text-xs text-zine-burntOrange/50">
                dica: mistura letras e números pra uma senha mais forte
              </p>
            )}
          {error && (
            <p role="alert" className="font-body text-sm text-zine-burntOrange">
              {error}
            </p>
          )}
          <Button type="submit" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'salvando…' : 'redefinir senha'}
          </Button>
        </form>
      </ZineFrame>
    </main>
  );
};

export default ResetPassword;
