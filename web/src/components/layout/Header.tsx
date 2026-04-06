import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSessionStore } from '@/store/sessionStore';
import LoginModal from '@/components/auth/LoginModal';

const THEME_KEY = 'quartinho:theme';

function getInitialDark(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const Header: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const role = useSessionStore((s) => s.role);
  const isAdminOrMod = role === 'admin' || role === 'moderator';
  const [loginOpen, setLoginOpen] = useState(false);
  const [dark, setDark] = useState(getInitialDark);

  const applyTheme = useCallback((isDark: boolean) => {
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => { applyTheme(dark); }, [dark, applyTheme]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    try { localStorage.setItem(THEME_KEY, next ? 'dark' : 'light'); } catch { /* */ }
  };

  return (
    <>
      <header className="bg-zine-periwinkle dark:bg-zine-periwinkle-dark border-b-4 border-zine-cream dark:border-zine-cream/30">
        <div className="mx-auto max-w-[640px] px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="h-9 w-9" />
            <h1 className="font-display text-3xl text-zine-cream tracking-wide">
              Quartinho
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dark ? 'modo claro' : 'modo escuro'}
              className="font-body text-lg text-zine-cream leading-none"
              title={dark ? 'modo claro' : 'modo escuro'}
            >
              {dark ? '☀' : '☾'}
            </button>
            {isAuthenticated ? (
              <>
                <span className="font-body text-sm text-zine-cream truncate max-w-[120px]">
                  {user?.displayName ?? user?.email ?? ''}
                </span>
                {isAdminOrMod && (
                  <Link
                    to="/admin"
                    className="font-body font-bold text-sm text-zine-burntYellow border-2 border-zine-burntYellow px-2 py-1 hover:bg-zine-burntYellow hover:text-zine-cream"
                  >
                    admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="font-body text-sm text-zine-cream border-2 border-zine-cream dark:border-zine-cream/30 px-2 py-1 hover:bg-zine-burntOrange"
                >
                  sair
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="font-body font-bold text-sm text-zine-cream border-2 border-zine-cream dark:border-zine-cream/30 px-3 py-1 hover:bg-zine-burntYellow"
              >
                entrar
              </button>
            )}
          </div>
        </div>
      </header>
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
};

export default Header;
