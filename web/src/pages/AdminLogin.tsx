import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useSessionStore } from '@/store/sessionStore';
import ZineFrame from '@/components/common/ZineFrame';

export const AdminLogin: React.FC = () => {
  const { user } = useAuth();
  const { role } = useSessionStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se já é admin, redireciona para /admin
  if (user && role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O login vai atualizar o user context automaticamente
      // Aguarda um momento para o role ser carregado
      setTimeout(() => {
        // A navegação acontece automaticamente via redirecionamento acima
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erro ao fazer login';
      if (message.includes('user-not-found')) {
        setError('usuário não encontrado');
      } else if (message.includes('wrong-password')) {
        setError('senha incorreta');
      } else if (message.includes('invalid-email')) {
        setError('email inválido');
      } else {
        setError('erro ao fazer login');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col gap-4 p-4 max-w-xs mx-auto">
      <ZineFrame bg="cream" borderColor="burntYellow">
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-2xl text-zine-burntOrange text-center">
            admin
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream text-zine-burntOrange focus:outline-none focus:border-zine-burntOrange disabled:opacity-50"
            />

            <input
              type="password"
              placeholder="senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="font-body px-3 py-2 border-2 border-zine-burntYellow bg-zine-cream text-zine-burntOrange focus:outline-none focus:border-zine-burntOrange disabled:opacity-50"
            />

            {error && (
              <p className="font-body text-sm text-red-600 text-center">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="font-body font-bold text-center bg-zine-burntYellow text-zine-cream px-4 py-2 border-4 border-zine-cream hover:bg-zine-burntOrange disabled:opacity-50"
            >
              {loading ? 'entrando...' : 'entrar'}
            </button>
          </form>
        </div>
      </ZineFrame>
    </main>
  );
};

export default AdminLogin;
